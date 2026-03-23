---
title: "BrewSite Website Repositioning for Technical PMs"
doc_type: prd
owner: Toolkit Product
status: approved
updated: 2026-03-22
change_history:
  - date: 2026-03-21
    author: "Codex"
    summary: "Created a new website PRD focused on technical PM positioning, broader content-creation messaging, and award-site design principles."
  - date: 2026-03-22
    author: "Toolkit PM"
    summary: "Marked approved after full implementation delivery. The technical PM repositioning is now live in the website: hero defines the category with React toolkit framing; messaging hierarchy follows Awe→Recognition→Scope→Authoring→Team→Trust→Action arc; team/trust framing implemented in Act 4 ecosystem scene; CTA flow with npm create brewsite in Act 5. All recommended modules implemented: messaging.ts, siteMap.ts, overlay components, shared scene helpers, 3 advanced effect widgets (SignalField, ShaderSurface, PostFX), motionProfile, perfTier, and telemetry. Implementation plan archived."
---

# BrewSite Website Repositioning for Technical PMs

## 1. Overview

This PRD defines a new strategic direction for the BrewSite marketing website in `apps/website/`.

The current site direction is visually stronger than the old placeholder version, but the message is still too narrow and too diffuse. It reads partly like a 3D demo reel, partly like a package catalog, and partly like a slides tool. That leaves the core story unclear:

**BrewSite is a React system for building technically rich, visually unforgettable product content.**

Slides are part of that story, but not the whole story. The broader category is:

- launch sites
- presentation decks
- product explainers
- architecture narratives
- design docs / technical docs
- interactive demos

The primary audience is the **technical PM**. Developers are the implementers. Marketing is a downstream stakeholder. The website must therefore do two things at once:

1. create desire through a world-class visual experience
2. make the product legible to someone who thinks in systems, dependencies, and tradeoffs

This PRD is intentionally strategic and implementation-aware. It sets the narrative, message architecture, visual direction, and system constraints for the redesign before code changes begin.

---

## 2. Problem Statement

The current website has three core problems.

### 2.1 The category definition is weak

The site implies "3D storytelling" but does not quickly explain what that means in concrete, work-relevant terms for a technical PM. The visitor should understand within the first two scroll beats that BrewSite helps teams turn complex product thinking into compelling content across multiple formats.

### 2.2 The product story is fragmented

The package surface is broad and real:

- `@brewsite/core` provides declarative scene authoring, compilation, playback, plugins, and theming.
- `@brewsite/diagram` provides diagrams, image panels, and screens.
- `@brewsite/model` provides GLTF models, animation, and labels.
- `@brewsite/charts` provides chart storytelling.
- `@brewsite/screens` provides screen/media elements.
- `@brewsite/slides` provides deck authoring and playback.
- `@brewsite/docs` provides documentation-site infrastructure.
- `@brewsite/claude-author`, `create-brewsite`, and `brewsite` provide authoring assistance and onboarding.

The website currently does not unify these into one buyer-facing narrative. It shows capabilities, but not a coherent system.

### 2.3 The tone is too close to "cool demo" and not close enough to "serious storytelling tool"

The website needs spectacle, but not spectacle alone. A technical PM will tolerate ambition only if the site also signals:

- conceptual clarity
- authoring leverage
- implementation credibility
- team usefulness

If the site feels like pure motion candy, the audience will not trust it.

---

## 3. Product Truths From The Package PRDs

The website message must be anchored to the actual product shape documented across the package PRDs.

### 3.1 Core truth

From the core PRDs, BrewSite is fundamentally:

- declarative scene authoring in JSX
- pre-baked tracks for O(1) playback
- strict compiler/runtime/render separation
- widget/plugin-based extension
- React-native integration via `SceneEngine`, `ScrollStage`, `SceneCanvas`, and overlay primitives

This is not a video editor. It is not a drag-and-drop slide toy. It is an authored software system.

### 3.2 Visual-system truth

From diagram, model, charts, screens, and theming PRDs, BrewSite already covers a substantial portion of technical storytelling primitives:

- systems diagrams
- architecture maps
- GLTF product/model scenes
- charts and data stories
- embedded screens and media surfaces
- shared theme infrastructure across packages

This means the website should market BrewSite as a **storytelling platform**, not a single-element library.

### 3.3 Slides truth

From `requirements/slides/prd/prd_slides.md`, slides are a real package with:

- a deck compiler
- slide player
- layouts
- themes
- text and graphic primitives

Slides matter and must appear prominently. But the website should present slides as one expression of the system, not the only expression.

### 3.4 Docs truth

From `requirements/docs/prd/prd_docs-package.md`, BrewSite also supports scroll-driven documentation surfaces. That materially strengthens the broader positioning around explainers, design docs, and technical narratives.

### 3.5 Tooling truth

From `requirements/claude-author/prd/prd_claude-author-package.md`, BrewSite includes guided authoring and onboarding tooling. That matters for trust. The site should not bury the fact that this is a usable ecosystem, not an isolated art object.

### 3.6 Marketing constraint

The website may use bespoke Three.js moments beyond the shipped package widgets when needed for emotional impact. That is allowed. But product claims must distinguish between:

- shipped package capabilities
- custom scene work used to make the site unforgettable

The website must never imply that every bespoke visual on the page is already a first-class packaged primitive.

---

## 4. Primary Audience

### 4.1 Primary persona: Technical PM

The technical PM is the center of gravity for the site.

This person:

- thinks in systems, flows, dependencies, and launch narratives
- owns or heavily shapes architecture explainers, roadmap presentations, launch storytelling, internal alignment docs, and executive updates
- works with developers to produce polished assets
- wants better storytelling quality without abandoning engineering rigor

The site must make this person feel:

- "This matches how I think."
- "This would make my work more persuasive."
- "My developers could actually build this."

### 4.2 Secondary personas

#### Developers

Developers need to see:

- React + TypeScript credibility
- real package boundaries
- authoring model clarity
- an onboarding path

#### Marketing / brand teams

Marketing teams need to see:

- cinematic output
- reusable content surfaces
- premium brand feel

But they are not the message anchor. The site should not sound like generic brand-marketing software.

---

## 5. Positioning

### 5.1 Positioning statement

**BrewSite is a React storytelling system for technical teams who need their ideas to land visually, spatially, and memorably.**

### 5.2 Category statement

BrewSite helps teams build:

- slide decks
- launch websites
- architecture explainers
- product walkthroughs
- technical docs
- interactive demo narratives

from one programmable storytelling stack.

### 5.3 What the website must make obvious

Within the first 20 seconds, the visitor should understand:

1. BrewSite is for high-impact technical storytelling.
2. It spans more than slides.
3. It is built for React/TypeScript teams.
4. It can produce premium, award-level experiences without becoming vague marketing theater.

### 5.4 Messages to avoid

- "3D for 3D's sake"
- "AI does everything"
- "A prettier slide deck"
- "Just a diagram tool"
- "A design toy for marketers"
- "A custom-agency-only platform"

---

## 6. Research Basis: What Award-Winning Websites Actually Optimize For

The redesign should not imitate award sites superficially. It should adopt the reasons they score highly.

### 6.1 Awwwards implication

Awwwards site scoring weights Design at 40%, Usability at 30%, Creativity at 20%, and Content at 10%. That means even highly visual winners are still judged heavily on clarity and usability. The BrewSite website cannot trade navigability and message coherence for motion. It must excel at both.

### 6.2 Webby implication

The Webby Awards judge websites and mobile sites on content, structure/navigation, visual design, functionality, interactivity, innovation, and overall experience. That reinforces the same conclusion: winning work is not only beautiful. It is structured, legible, interactive, and whole.

### 6.3 Performance implication

web.dev guidance remains clear that web animation should target 60fps, rely on cheaper composited properties where possible, and respect reduced-motion preferences. For BrewSite, that means the site must feel premium on mobile, not just on a desktop GPU.

### 6.4 Strategic conclusion

The right interpretation of "award-winning" for BrewSite is:

- cinematic first impression
- minimal but precise copy
- obvious scroll and narrative control
- crisp mobile behavior
- reduced-motion respect
- fast enough performance that the ambition feels intentional instead of indulgent

---

## 7. Strategic Narrative Shift

The current site direction emphasizes awe and then package reveal.

The new site direction must emphasize:

**Awe -> Recognition -> Scope -> Authoring Model -> Team Fit -> Trust -> Action**

That sequence is better for a technical PM because it answers, in order:

1. Why should I care?
2. Is this for my kind of work?
3. How broad is it?
4. How is it actually built?
5. Who on my team uses it?
6. Is it credible?
7. What do I do next?

---

## 8. Recommended Messaging Architecture

### 8.1 Hero message

The hero should define the category, not only the aesthetic.

Recommended primary stack:

- Eyebrow: `React toolkit for technical storytelling`
- Headline: `Turn product thinking into decks, docs, sites, and demos.`
- Support line: `Author diagrams, models, charts, screens, and slides in JSX. Compile once. Play smoothly.`
- Proof rail: `Diagrams • Models • Charts • Screens • Slides • Docs`

This is the recommended direction, not placeholder copy. The exact words may still tighten during implementation, but the structure is fixed. The hero must name both:

- the output category
- the implementation model

The current "3D storytelling" phrasing is directionally right but incomplete. It can remain as supporting language deeper in the page, but it should not be the homepage's primary semantic anchor.

Recommended alternatives for headline testing:

- `Build technical stories that feel alive.`
- `From architecture narrative to launch surface.`
- `One storytelling system for decks, docs, sites, and demos.`

The category-first line is preferred because it is the clearest to the technical PM and still leaves room for the neon sign / immersive hero to carry the emotional load.

### 8.2 Recognition message

The next section must make the technical PM feel seen.

Core problem framing:

- your product thinking is multi-layered
- your delivery formats are fragmented
- the same story gets rebuilt as deck, site, doc, screenshot, and handoff artifact

This section must not be whiny. It should feel sharp and accurate.

Recommended copy direction:

- Headline: `You rebuild the same story too many times.`
- Support line: `Deck for the review. Doc for engineering. Site for launch. Screenshot for everyone else.`
- Punchline: `Same product. Flattened five ways.`

Copy to avoid:

- abstract lines about "the future of storytelling"
- generic anti-PowerPoint messaging
- problem framing that sounds like a pure marketing complaint rather than a technical workflow problem

### 8.3 Scope message

The site must explicitly broaden the story beyond slides.

The message pattern should be:

- slides are one output
- launch sites are one output
- design docs / technical docs are one output
- architecture explainers are one output
- interactive demos are one output

All of them come from a shared scene-thinking model.

Recommended copy direction:

- Headline: `One story. Many surfaces.`
- Support line: `Ship the launch site. Present the deck. Publish the explainer. Keep the system thinking intact.`
- Visual labels: `Slides`, `Docs`, `Sites`, `Explainers`, `Demos`

Requirement: slides must be one of the named surfaces in this section, but never the only named surface.

### 8.4 Authoring message

The authoring model must be summarized simply:

- write scenes in JSX
- compile to a baked track
- play back with smooth runtime behavior

This is one of the strongest product truths in the entire stack. It should be one of the strongest messages on the site.

Recommended copy direction:

- Headline: `Write scenes in JSX.`
- Support line: `BrewSite compiles snapshots into a baked runtime track so the browser plays the story instead of inventing it on the fly.`
- Supporting proof labels: `JSX`, `Compile`, `Track`, `Runtime`

Implementation note: this section should show real-looking code, not pseudo-marketing code. The code sample should include at least one scene primitive and one higher-level element such as `Diagram`, `Chart`, or `Slide`.

### 8.5 Team message

The site should directly name how different teams relate to BrewSite:

- PM frames the story
- developer builds the experience
- marketing reuses the output

That is much stronger than a generic "for teams" claim.

Recommended copy direction:

- Headline: `PM frames it. Dev ships it. Marketing reuses it.`
- Support line: `BrewSite is strongest when one story needs to survive across product, engineering, launch, and presentation surfaces.`

### 8.6 Trust message

The trust section must combine:

- open-source / licensing status where accurate
- TypeScript + React framing
- package ecosystem
- starter CLI / onboarding
- authoring assistant / docs tooling

Trust should feel technical, not corporate.

Recommended copy direction:

- Headline: `Built like software, not a one-off demo.`
- Support line: `TypeScript. React. Published packages. Starter CLI. AI-assisted docs search.`

Recommended trust strip:

- `TypeScript strict`
- `React 18+`
- `MIT`
- `npm create brewsite`
- `Published packages`

### 8.7 Copy rules

The homepage copy shall follow these rules:

1. Every major section gets one clear job. No section should try to explain the whole product.
2. The hero, transformation, and CTA acts use short copy. The recognition and authoring acts earn slightly longer copy.
3. The site shall not use vague category labels like `immersive communication`, `next-gen storytelling`, or `AI-powered narratives`.
4. The site shall not bury implementation truth behind cinematic language. A technical PM should be able to tell a developer what BrewSite is after one scroll.
5. The site shall treat `slides` as a concrete proof point, not as the umbrella noun for the whole category.

---

## 9. Content Strategy Requirements

### 9.1 Required product claims

The landing page must make all of the following claims legible:

1. BrewSite is for technical storytelling, not generic website decoration.
2. BrewSite outputs more than slide decks.
3. Slides are still a first-class part of the product story.
4. The authoring model is React + TypeScript + JSX.
5. The system spans diagrams, models, charts, screens, slides, themes, docs, and onboarding tooling.
6. Custom Three.js work is possible inside the same broader system.

### 9.2 Required proof moments

The website must contain at least one concrete proof moment for each of these:

- diagrams / architecture
- charts / data
- slides / deck storytelling
- screens or media
- code authoring
- ecosystem breadth

### 9.3 Copy ratio

The site should remain visually led, but this audience needs slightly more semantic grounding than a pure portfolio site.

Target content ratio:

- hero and transformation moments: ultra-short copy
- recognition and scope moments: short but explicit copy
- authoring and trust moments: the clearest copy on the page

The site should not collapse into long marketing paragraphs.

---

## 10. Visual Direction

### 10.1 Design principle

The aesthetic should feel like **precision plus theater**.

Not:

- generic neon cyber
- generic SaaS minimalism
- generic agency chaos

The target feeling is:

- editorial
- technical
- premium
- controlled
- surprising

### 10.2 Recommended visual language

- expressive display type with a serious technical counterpart
- sharp layout geometry, not soft SaaS cards everywhere
- atmospherics and light as narrative tools
- a stronger sense of materiality than flat gradients alone
- transitions that feel authored, not templated

### 10.3 Typography direction

Avoid default-stack energy.

Recommended direction:

- headline family: distinctive grotesk or editorial sans
- body family: highly readable technical sans
- code family: serious mono, not decorative mono

Typography should create contrast between narrative and system language.

### 10.4 Color direction

The existing cold-to-warm arc in `requirements/website/prd/note_brand_strategy.md` is good and should be preserved in principle. But the redesign should use color more strategically to signal meaning:

- cold: intrigue, ambiguity, possibility
- brighter structured tones: system clarity
- warmer tones: human understanding and confidence
- resolved palette: action and trust

The site should not sit in one mood from top to bottom.

---

## 11. Interaction Direction

### 11.1 Scroll model

The website should keep the scroll-driven narrative, because it is native to BrewSite's core strengths.

But the interaction contract must remain obvious:

- visitors should always know they can keep scrolling
- section progression should feel deliberate, not sticky or trapped
- navigation should make scene position legible

### 11.2 Motion philosophy

Motion should do one of three jobs only:

1. establish wonder
2. clarify a relationship
3. mark progression

If a motion moment does none of those, it should be cut.

### 11.3 Bespoke Three.js usage

The redesign may include custom scene choreography beyond current packaged widgets. Strong candidates:

- volumetric transitions
- procedural particles or ribbons
- depth-based content reveals
- material transformations
- spatial typography or signal lines

These should be used sparingly and purposefully, mainly in hero and transition beats.

### 11.4 Advanced feature priorities

The redesign should use advanced Three.js features in this order of priority:

1. HDR / EXR environment lighting and reflections
2. particle systems for authored transformation beats
3. one coherent shader language for signature surfaces
4. restrained post-processing
5. one immersive authored environment as the page's spatial anchor

This order matters. Environment and materials should do most of the work. Particles and post-processing are accents, not the base layer.

### 11.5 HDR environment design

HDR environments are the preferred first upgrade because they increase material quality, reflections, mood, and scene coherence without requiring constant motion.

Implementation recommendation:

- Store authored environment assets under `apps/website/public/environments/`.
- Ship 3 core environments only:
  - `hero-chamber.hdr`
  - `warm-atrium.hdr`
  - `systems-observatory.hdr`
- Use one environment family per narrative act instead of switching every scene.
- Reuse the same environment within adjacent scenes and animate lighting/background/floor behavior for continuity.

Design recommendation:

- Hero / Act A: dark chamber with high-contrast cyan reflections
- Recognition / Act B: flatter, less reflective environment
- Scope / Product / Authoring acts: progressively warmer or more structured environments
- Trust / CTA: resolved environment with cleaner, calmer reflection behavior

Technical rule:

- Environment assets are scene infrastructure, not hero content. They should support material legibility and mood, not become the main attraction.

### 11.6 Particle system design

Particles are approved for the redesign, but only for directed narrative events.

Approved particle jobs:

- particles assembling into surfaces or diagrams
- particles dissolving flat artifacts into spatial layers
- low-density atmospheric fields around the hero sign or immersive chamber
- signal-flow trails between content surfaces

Disallowed particle jobs:

- constant decorative glitter
- heavy particle fog behind text
- dense screen-filling particle noise during content-heavy acts

Implementation recommendation:

- Create a website-local particle widget at `apps/website/src/widgets/signal-field/`.
- Follow the standard module pattern:
  - `types.ts`
  - `dsl.tsx`
  - `compile.ts`
  - `render.ts`
  - `SignalFieldWidget.ts`
  - `index.ts`
- The widget should initially own one renderer path only: GPU-driven `THREE.Points` with `BufferGeometry`.
- Do not ship multiple particle engines in v1.

Recommended state shape:

```ts
type SignalFieldState = {
  readonly enabled: boolean;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly z: number;
  readonly count: number;
  readonly opacity: number;
  readonly size: number;
  readonly speed: number;
  readonly depth: number;
  readonly spread: number;
  readonly flow: 'orbit' | 'stream' | 'assemble' | 'dissolve';
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly targetBias: number;
};
```

Authoring rule:

- `SignalField` is for scene-scale motion accents.
- It is not a replacement for charts, diagrams, or typography.

### 11.7 Custom shader design

The redesign should adopt one consistent shader language rather than a pile of unrelated shader tricks.

Recommended shader language:

- fresnel-edged translucent surfaces
- animated emissive gradients
- subtle scan / signal motion
- depth-aware dissolve or reveal behavior

Recommended use cases:

- hero sign support surfaces
- transformation ribbons between flat and spatial content
- package or output-surface reveals
- immersive chamber walls or glass planes

Implementation recommendation:

- Create a website-local shader surface widget at `apps/website/src/widgets/shader-surface/`.
- Standard file layout:
  - `types.ts`
  - `dsl.tsx`
  - `compile.ts`
  - `render.ts`
  - `ShaderSurfaceWidget.ts`
  - `index.ts`
- Keep the widget focused on planes, ribbons, and thin shell geometry. Do not make it a generic catch-all shader sandbox.

Recommended state shape:

```ts
type ShaderSurfaceState = {
  readonly enabled: boolean;
  readonly kind: 'plane' | 'ribbon' | 'shell';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly z: number;
  readonly opacity: number;
  readonly palette: 'hero' | 'violet' | 'warm' | 'aurora';
  readonly edgeGlow: number;
  readonly distortion: number;
  readonly scanStrength: number;
  readonly reveal: number;
};
```

Shader rule:

- The site shall use at most two custom shader families in v1:
  - a surface shader
  - a particle shader enhancement, only if the basic `PointsMaterial` path proves too limiting

### 11.8 Post-processing design

Post-processing is approved, but it must be implemented as a contained website-local concern and kept behind clear performance gates.

Implementation recommendation:

- Create `apps/website/src/widgets/postfx/`.
- Implement a `PostFxWidget` that owns:
  - `EffectComposer`
  - `RenderPass`
  - `UnrealBloomPass`
  - optional one custom `ShaderPass`
- The widget shall implement:
  - `IRendererLifecycle`
  - `IExtraRenderPass`
- The widget shall not own scene content. It only owns the post-render pipeline.

Recommended state shape:

```ts
type PostFxState = {
  readonly enabled: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
  readonly vignetteStrength: number;
  readonly gradeMix: number;
  readonly quality: 'high' | 'medium' | 'off';
};
```

Render-pipeline rules:

1. Bloom must be subtle enough that text edges stay crisp.
2. The site shall not stack multiple cinematic passes by default.
3. Mobile and reduced-motion paths shall be allowed to disable the widget entirely.
4. PostFX parameters should transition by scene, not by ad hoc timers.

### 11.9 Immersive environment recommendation

The site should include one fully immersive environment rather than treating every act as a neutral stage.

Recommended environment concept:

- `Signal Chamber`

Definition:

- a contained spatial world
- reflective but controlled materials
- subtle atmospheric particles
- one dominant sign or narrative object
- clear depth layers for text and transitional motion

This should be the hero's home world and the emotional anchor of the site.

### 11.10 Effects to avoid

The redesign shall explicitly avoid:

- ocean / water simulations
- strong god rays
- persistent glitch effects
- aggressive chromatic aberration
- heavy depth-of-field that softens the page
- large full-screen fragment effects behind important copy

Reason:

- these effects communicate general demo-scene spectacle, not technical-storytelling precision
- they also create unnecessary performance and readability risk

---

## 12. Recommended Information Architecture

The landing page should be restructured into the following sequence.

### 12.1 Act A: Category-defining hero

Goal:

- create immediate emotional interest
- define what BrewSite is for in one sentence

Must show:

- high-craft 3D moment
- explicit category line
- immediate signal that the stack is React-driven

### 12.2 Act B: The technical PM problem

Goal:

- make the audience feel recognized

Message:

- one story gets fragmented into deck, doc, site, and handoff artifacts
- the content gets flatter as it moves through the org

Visual:

- deliberately flattened or fragmented system view

### 12.3 Act C: Content spectrum

Goal:

- expand the story beyond slides while still including slides clearly

Must show:

- slides
- websites
- technical/design docs
- architecture explainers
- interactive demos

This act is where the site corrects the current "is this just slides?" ambiguity.

### 12.4 Act D: Product primitives

Goal:

- show that the visual range comes from concrete modules

Must show:

- diagrams
- charts
- models
- screens/media
- slides
- themes / visual system

This should feel like capability proof, not a package table dump.

### 12.5 Act E: Authoring model

Goal:

- make the system understandable to developers and credible to PMs

Must show:

- JSX scene authoring
- compile / bake / playback story
- plugin model

### 12.6 Act F: Team operating model

Goal:

- show how PM, dev, and marketing fit around the product

Recommended framing:

- PM shapes narrative
- dev ships interaction
- marketing reuses the result across touchpoints

### 12.7 Act G: Trust / ecosystem

Goal:

- make the product feel real, usable, and extensible

Must cover:

- package ecosystem
- TypeScript / React
- onboarding commands
- docs / authoring assistance
- licensing and maturity claims only where accurate

### 12.8 Act H: CTA

Goal:

- convert interest into an immediate next step

Primary CTA:

- `npm create brewsite`

Secondary CTA:

- GitHub
- package/docs entry points as appropriate

---

## 13. Future Implementation Boundaries

This PRD does not implement the site, but it should constrain the eventual implementation.

### 13.1 Primary files expected to change

- `apps/website/src/landing/LandingPage.tsx`
- `apps/website/src/scenes/websiteFlow.tsx`
- `apps/website/src/style.css`
- `apps/website/src/scenes/act0/*`
- `apps/website/src/scenes/act1/*`
- `apps/website/src/scenes/act2/*`
- `apps/website/src/scenes/act3/*`
- `apps/website/src/scenes/act4/*`
- `apps/website/src/scenes/act5/*`

### 13.2 Recommended new modules

- `apps/website/src/content/messaging.ts`
  - source of truth for headlines, support lines, and role framing
- `apps/website/src/content/siteMap.ts`
  - section metadata, nav labels, CTA destinations, and tracking identifiers
- `apps/website/src/landing/components/*`
  - shared overlay layouts and trust/content modules
- `apps/website/src/scenes/shared/*`
  - reusable scene materials, light rigs, authored motion helpers, and proof components
- `apps/website/src/widgets/signal-field/*`
  - particle field widget for atmospheric and transformational motion
- `apps/website/src/widgets/shader-surface/*`
  - custom shader planes, ribbons, and shell surfaces
- `apps/website/src/widgets/postfx/*`
  - website-local post-processing widget built on `IExtraRenderPass`
- `apps/website/src/utils/motionProfile.ts`
  - reduced-motion and feature-tier resolution
- `apps/website/src/utils/perfTier.ts`
  - device capability heuristics for `high` / `medium` / `low` effect paths
- `apps/website/public/environments/*`
  - HDR / EXR environment assets
- `apps/website/public/textures/noise/*`
  - optional lightweight textures for shader and particle variation

### 13.3 Plugin registration design

`createWebsitePlugins()` in `apps/website/src/widgetSetup.ts` shall remain the single registration point for website-local widgets.

Recommended registration expansion:

```ts
return [
  corePlugin(),
  modelPlugin({ manifestUrl }),
  diagramPlugin(),
  {
    createWidgets: () => [
      new NeonSignWidget(),
      new SignalFieldWidget(),
      new ShaderSurfaceWidget(),
      new PostFxWidget(),
    ],
    registerHandlers: () => {},
  },
];
```

Rule:

- all advanced effects used by the website must be implemented as app-local widgets or scene helpers
- no changes to published package boundaries are allowed unless a general-purpose abstraction is clearly reusable outside the website

### 13.4 State management direction

The site should remain mostly stateless outside engine progress and simple UI controls.

Use:

- `SceneEngine` / scene progress as the primary narrative state
- local React state for transient UI only
- derived nav state from current scene/tick
- feature-tier and motion-profile utilities for effect gating

Do not introduce a global client state library for the marketing site.

### 13.5 Scene and effect orchestration design

Advanced effects shall be authored at the scene level, not managed by free-running timers.

Rules:

1. Every custom effect widget must be scene-driven through compiled state.
2. Scene transitions, not imperative controller code, should determine when effects intensify or recede.
3. Reusable effect presets belong in `apps/website/src/scenes/shared/` and `apps/website/src/content/`, not inline in each act file.
4. Hero, transformation, and CTA acts may use stronger effects. Recognition, authoring, and trust acts should bias toward clarity over spectacle.

Recommended effect presets:

- `heroSignalFieldPreset`
- `dimensionalShiftSignalFieldPreset`
- `warmAuthoringBloomPreset`
- `auroraTrustPalette`
- `reducedMotionPostFxPreset`

### 13.6 Error handling direction

The redesign must degrade gracefully if scene loading or WebGL fails.

Requirements:

- core copy remains readable without WebGL
- CTA remains usable without WebGL
- reduced-motion users get a calmer experience
- loading state feels intentional, not broken
- missing HDR assets must fall back to simpler environment / lighting paths
- post-processing initialization failure must not break the main render path
- custom widget asset failures shall log and disable locally instead of crashing the page

### 13.7 Motion-profile and feature-tier design

The redesign must centralize effect gating instead of scattering `isMobile` checks throughout scene files.

Create `apps/website/src/utils/motionProfile.ts`:

```ts
type MotionProfile = {
  readonly reducedMotion: boolean;
  readonly allowParticles: boolean;
  readonly allowPostFx: boolean;
  readonly allowHeavyShaderDistortion: boolean;
  readonly environmentQuality: 'high' | 'medium' | 'low';
};
```

Create `apps/website/src/utils/perfTier.ts`:

```ts
type PerfTier = 'high' | 'medium' | 'low';
```

Usage rules:

- `high`: full HDR, particles, restrained bloom, richer shader motion
- `medium`: HDR or simplified environment, lower particle count, lighter bloom
- `low`: minimal or no particles, postfx off, simplified materials, strongest focus on overlay clarity
- reduced-motion: keep environment/material quality where affordable, but disable non-essential ambient animation and postfx pulses

### 13.8 Telemetry direction

When implementation begins, the site should instrument:

- section reached
- scroll completion depth
- CTA clicks
- GitHub clicks
- command-copy interactions
- reduced-motion usage

This is necessary to tell whether the redesign improves clarity, not just aesthetics.

---

## 14. Performance, Accessibility, and Mobile Requirements

### 14.1 Mobile-first requirement

The redesign must be reviewed as a phone experience first, not adapted from desktop afterward.

The page should feel premium on mobile, not like a reduced fallback.

### 14.2 Motion accessibility

The site must respect reduced-motion preferences and provide calmer variants for non-essential animated reveals.

### 14.3 Performance requirements

The site should target:

- stable perceived smoothness on modern phones
- 60fps where animation is active
- minimal non-essential layout thrash in overlays
- careful use of transforms/opacity for DOM animation
- bounded particle counts by feature tier
- HDR reuse across adjacent scenes to avoid asset churn
- no mandatory dependency on heavy postfx for baseline scene readability

### 14.4 Readability requirements

Even at peak visual intensity:

- the current section message must remain decipherable
- navigation must remain operable
- code blocks and proof copy must remain readable on mobile
- bloom and shader glow shall never wash out body copy or command surfaces
- the hero may be atmospheric, but the CTA and code acts must be visually cleaner than the transformation acts

### 14.5 Testing strategy

Implementation work for the redesign shall include:

- typecheck coverage for all new website-local widget modules
- compile-path tests for new widget state compilation where practical
- manual verification on mobile-width viewports for:
  - hero readability
  - particle density
  - code block legibility
  - CTA clarity
- reduced-motion verification
- WebGL failure-path verification
- Lighthouse review focused on:
  - performance
  - accessibility
  - best practices

Recommended test targets:

- widget state merge behavior
- renderer init / dispose safety
- postfx fallback behavior when composer setup fails
- motion-profile gating behavior

---

## 15. Non-Goals

- Repositioning BrewSite as a no-code tool
- Repositioning BrewSite as slides-only software
- Competing with generic website builders on breadth
- Turning the landing page into full documentation
- Claiming every bespoke site visual is a shipped package primitive
- Building a portfolio site that impresses designers but confuses buyers

---

## 16. Success Metrics

The redesign should be evaluated against both communication and experience metrics.

### 16.1 Communication metrics

- A first-time visitor can accurately answer "What is BrewSite?" after the hero and next section.
- A first-time visitor understands that slides are included but not the whole category.
- A developer can identify the authoring model as React/TypeScript/JSX without digging.

### 16.2 Experience metrics

- higher scroll completion than the current site
- strong CTA interaction rate
- lower bounce from the hero
- no major mobile readability regressions

### 16.3 Qualitative bar

The site should feel like something a technical PM would send to:

- an engineer
- a founder
- a design partner
- a conference organizer

without needing to explain what the product is first.

---

## 17. Launch Criteria

Before implementation is considered complete, the new website direction must satisfy all of the following:

1. The hero clearly defines the category, not just the vibe.
2. Slides are explicit on the page, but the site also clearly covers docs, websites, explainers, and demos.
3. The technical PM audience is directly addressed in message and examples.
4. The authoring model is explained simply and credibly.
5. The site preserves high visual ambition without sacrificing usability.
6. The mobile experience feels intentionally designed.
7. Reduced-motion handling is implemented.
8. The CTA path from interest to `npm create brewsite` is obvious.

---

## 18. References

Research used in shaping this PRD:

- Awwwards score breakdown and evaluation framing
- The Webby Awards 2025/2026 judging criteria for Websites and Mobile Sites
- `web.dev` guidance on animation performance and `prefers-reduced-motion`
- official Three.js docs for:
  - `HDRLoader`
  - `EXRLoader`
  - `PMREMGenerator`
  - `ShaderMaterial`
  - `Points` / `PointsMaterial`
  - `EffectComposer`
  - `UnrealBloomPass`
  - `RoomEnvironment`
- BrewSite package PRDs across core, diagram, model, charts, screens, slides, docs, and claude-author
