---
title: "BrewSite Website — Unified Content & Brand Proposal"
doc_type: note
owner: Toolkit Product
status: approved
updated: 2026-03-02
authors:
  - pm-code (scene-by-scene analysis, structural fixes, copy, code snippets)
  - pm-brand (brand voice, personas, differentiators, emotional arc)
change_history:
  - date: 2026-03-02
    author: pm-code + pm-brand
    summary: "Initial consensus reached. Defined 13-scene flow, scene-by-scene copy, websiteFlowScenes order, and chart teaser scene."
  - date: 2026-03-02
    author: pm-code + pm-brand
    summary: "Revised per product owner direction: every scene pairs live 3D output with a 5–10 line JSX snippet (real DSL prop names, no pseudocode). Cut three scenes that had no live demo + working code pairing: scene_03_ecosystem (text cards only), scene_01_chart_teaser (chart package not yet shipped), scene_01_foundation (empty room, pure synthesis narrative). scene_02_core_baked retained — its before/after snippet demonstrates the declarative model explicitly. Revised to 10-scene flow. Chart awareness handled by hero badge row only. Ecosystem positioning handled by hero badge row only."
---

# BrewSite Website — Unified Content & Brand Proposal

This document is the single authoritative source for the BrewSite marketing website rewrite. It supersedes `note_pm_code_content_proposal.md` and `note_pm_brand_strategy_proposal.md`. All decisions were reached through structured debate and a final product-owner direction: **focus on the sauce, not how the sauce is made.** Copy leads with the cinematic output and the authoring experience — not the compiler pipeline, runtime architecture, or internal mechanisms.

A developer, scene author, or copywriter should be able to implement every change here without asking any clarifying questions.

> **Product owner constraint:** Do not explain O(1) sampling, SceneTrack baking, widget SDK architecture, ProgressManager internals, or any runtime implementation detail in overlay copy. Those belong in docs. The website sells the output: gorgeous scroll-driven 3D that's trivially easy to author.

> **Design principle:** Every content scene pairs live 3D output with a concise JSX snippet (5–10 lines, real DSL prop names, no pseudocode, no ellipsis). The snippet is the proof — not supplementary copy. The story lands fast. Assume the visitor is skeptical and impatient. The contrast between a short snippet and an impressive visual IS the message.

---

## Part 1: Who This Site Is For

Three personas, in priority order.

### Persona 1: The Technical PM Building Presentations

**Archetype:** Technical product manager or growth engineer at a B2B SaaS. Comfortable reading code, can write React, owns the marketing site and conversion rate. Also builds pitch decks, conference talks, architecture walk-throughs for internal alignment.

**Frustration:** "We pay $40K for an animated product video that's out of date in six months. Our Webflow site has a hardcoded Lottie of our product that looks nothing like the actual product. Our architecture diagrams are stuck in Notion and look terrible in investor decks. We want to show our data visualization capabilities with a real chart — not a screenshot."

**What BrewSite gives them:** Architecture diagrams that look like architecture — not PowerPoint boxes. Product demo scenes that update in code when the product changes. Composable scenes a PM can copy, a designer can tweak, and a dev can deploy. A presentation experience embedded in the marketing site that doesn't require video.

**What they evaluate:** Does it look impressive? Can my team maintain it? Is it really faster than a design agency?

---

### Persona 2: The Frontend Engineer Who's Outgrown CSS Animations

**Archetype:** Senior frontend developer, 4–8 years experience, TypeScript fluent. Owns or influences the marketing site and product demo pages. Has tried Spline, Rive, GSAP, and at least one homegrown Three.js project they maintain nervously.

**Frustration:** "Spline is beautiful but I can't compose it with real React state. Three.js takes three weeks to get one decent animated scene. Rive is great for 2D but falls apart when I want depth or camera moves. Framer is someone else's design language. I've been Frankensteining gsap + canvas + Three.js utilities and it falls apart every time the design changes."

**What BrewSite gives them:** Declarative 3D in the same codebase as the rest of the product. TypeScript catches authoring errors. The compiler handles transitions. Mobile works.

**What they evaluate:** Bundle size. GitHub stars. The examples repo. They will clone it before reading the README.

---

### Persona 3: The Developer Advocate at a Dev-Tools Company

**Archetype:** DevRel engineer or engineering lead at an infrastructure company, cloud platform, or developer tool. Writes code. Speaks at conferences. Their audience is technical — their marketing has to prove it, not just claim it.

**Frustration:** "Our architecture diagrams look terrible in every presentation. The design team won't touch them. We have a Spline animation of our product but it's abstract swooshes that have nothing to do with our actual system topology. Our engineers can't maintain the marketing site animations — it requires a specialist."

**What BrewSite gives them:** Real architecture diagram rendering — AWS icons, routing, swimlanes, real data relationships, not decorative shapes. DSL files a frontend engineer can maintain. Conference-quality output that reads correctly to a technical audience.

**What they evaluate:** Are the icons real? Does the layout engine actually work at 20+ nodes? Can I hand this to an engineer who doesn't know Three.js?

---

### Who BrewSite is NOT for

- Designers who don't write code. There is no visual editor.
- Teams that want a one-click 3D landing page template. BrewSite is a toolkit, not a product.
- Anyone whose entire 3D requirement is one animated logo. The integration cost pays off at scene-level complexity.
- Anyone who needs physics, audio, VR, or real-time streaming data.

---

## Part 2: Core Positioning

### Primary positioning statement (hero, meta description)
> **"The React toolkit for 3D storytelling."**

Every word is load-bearing:
- **React** — not "JSX," not "web." React is the paradigm: component model, declarative, TypeScript-native.
- **toolkit** — modular packages. Install only what you need.
- **3D** — distinguishes from CSS animation, SVG tools, Lottie, Rive.
- **storytelling** — the use case: architecture walk-throughs, product demos, investor decks, conference talks. Not "3D UI" (sounds like a dashboard). Not "3D animation" (sounds like a game engine).

### Primary tagline (hero — locked)
> **"Scenes as React. Rendered like film."**

This is the hero tagline. It is locked. "Scenes as React" = what the author does. "Rendered like film" = what visitors see. Two phrases, no mechanism explanation.

### Act 1 expanded tagline (scene_01_core_intro headline)
> **"Write the scenes. The compiler renders the film."**

Used as the headline for the first content scene. An active-voice expansion of the hero tagline: "Write the scenes" = the developer's action, "the compiler renders the film" = attribution of the output without explaining how. The hero uses the shorter evocative version; Act 1 uses the longer explicit version. They are the same semantic claim, not a contradiction.

### Secondary message (first act)
> **"Describe the state. Ship the transition."**

Used on scene_02_core_baked. Explains the declarative model in five words. The accompanying code snippet demonstrates it — two scene states, BrewSite generates the animation between them.

### The complete toolkit claim (full toolkit vision — apply when @brewsite/chart ships)
> **"3D models. Architecture diagrams. Data charts. In the same scene. In the same React tree."**

No competitor can say this. Spline does models. Diagram tools do diagrams. Charting libraries do charts. BrewSite puts all three in the same coordinate system, same lighting, same camera, same declarative authoring model. This is architecturally true, not a marketing bundle.

---

## Part 3: Key Differentiators

### Differentiator 1: Declarative snapshots, not keyframes

**Technical reality:** Scene files describe state at rest. No animation math. No frame callbacks. The compiler generates all transitions automatically.

**Headline:** "No animation loops. No frame math. Just describe the scene."

**vs. alternatives:**
- Three.js DIY: you write every lerp, every easing curve, every fade
- GSAP: you define keyframes and timelines — you own the animation math
- Theatre.js: external timeline editor separate from your code
- **BrewSite: JSX snapshots → compiler generates animation automatically**

---

### Differentiator 2: 3D diagrams with real icons, real layout, real routing

**Technical reality:** `@brewsite/diagram` provides: 9+ cloud provider icon namespaces (100+ icons), 4 auto-layout algorithms, automatic edge routing with 4 algorithms, 4 visual themes, hover/click interaction — all as real Three.js geometry with PBR materials.

**Headline:** "From whiteboard to 3D."

**Body:** "No Figma export. No third-party diagram tool. Just declare nodes and edges in JSX."

**vs. alternatives:**
- Spline: free-form 3D design, not a diagram system
- Mermaid/D2: 2D SVG — no PBR, no camera
- Custom Three.js: build the layout engine, edge router, icon system from scratch

---

### Differentiator 3: 3D charts as real geometry, not textures (coming in @brewsite/chart)

**Technical reality:** Charts are native Three.js objects. Bar charts = real `BoxGeometry`. Line charts = `TubeGeometry`. Pie slices = `ExtrudeGeometry`. A camera can orbit around a bar chart and see bars from the side. Bars cast shadows. Slices catch environment light.

**Headline:** "The bars cast shadows. Because they're real."

**vs. alternatives:** Every other React charting library (ECharts, Recharts, Nivo) renders to a 2D canvas and optionally textures it onto a Three.js plane. You get a flat picture on a flat rectangle. BrewSite charts are real 3D objects — the camera, lighting, and materials apply to the data itself.

---

### Differentiator 4: React-native authoring

**Technical reality:** Scenes are JSX. `<Scene>`, `<Camera>`, `<ModelRouter>`, `<DiagramCanvas>` are React components. TypeScript catches authoring errors at compile time.

**Headline:** "If you can write a React component, you can write a scene."

**vs. alternatives:**
- Spline: proprietary visual editor, non-code
- Lottie: After Effects export files
- Rive: GUI-defined state machines
- GSAP/Theatre.js: timeline code outside your component model
- **BrewSite: the scene IS the component**

---

## Part 4: Brand Voice

### Five voice attributes

**1. Declarative.** Like the DSL itself. Short sentences. Subject-verb-object. No hedging. "The compiler renders the transitions. You render the story." — not "With BrewSite, you can create declarative animations that are compiled at build time."

**2. Cinematically precise.** Every word earns its place. "Rendered like film" does four things at once: claims pre-baked output, evokes craft, distinguishes from real-time rendering, names a film production metaphor. Sloppy synonyms are cut.

**3. Technically confident, not academic.** "Pre-baked at compile time" is correct and says something. "O(1) sampling" belongs in documentation, not on the landing page. Know when to elevate the technical vocabulary and when to stay at the outcome level.

**4. Respects developer intelligence.** No exclamation points on feature claims. No "super easy setup." No handholding. Show the code — let the developer decide if it's impressive.

**5. High-craft studio, not startup.** The rivet bezel, the reflective floor, the neon sign — this product was made by people who care what things look like. The copy comes from the same place: precise, spare, slightly cool.

---

### 5 headlines IN voice

1. **"No animation loops. No frame math. Just describe the scene."** — Specific about what it removes. Respects developer frustration.
2. **"30 characters. 50 lines of JSX."** — Concrete proof. Trust the developer to understand why the ratio matters.
3. **"The bars cast shadows. Because they're real."** — Short, technical, slightly dramatic. The second sentence lands because it's not explaining — it's stating.
4. **"Drill down. Stay in the scene."** — Explains an interaction capability in five words. Specific, memorable, demonstrable.
5. **"Write the scenes. The compiler renders the film."** — Two active imperatives. Developer writes; compiler delivers.

### 5 headlines OUT of voice

1. **"Create stunning 3D animations in minutes!"** — "Stunning," "create," and the exclamation point are all wrong.
2. **"The most powerful 3D toolkit for the modern web."** — "Most powerful" is unmeasurable. "Modern web" is empty.
3. **"Bring your marketing pages to life with immersive 3D experiences."** — "Bring to life" is a cliché. "Immersive 3D experiences" is jargon.
4. **"Easy to learn, powerful to use."** — Most exhausted line in developer marketing.
5. **"Your architecture diagram deserves a camera."** — "Deserves" is a luxury product register, paternalistic toward the engineer persona. Dropped.

---

### Vocabulary list

**Use these:**

| Word/Phrase | Why |
|---|---|
| declarative | Technically accurate; resonates with React developers |
| pre-baked | Specific to the compiler innovation; not used by competitors |
| scene | BrewSite's core abstraction unit; use consistently |
| compile / compiled | Reinforces the mental model |
| toolkit | Modular — not a framework, not a library |
| ecosystem | Signals maturity and composability |
| GLTF | Use the correct acronym; don't say "3D model file" |
| PBR materials | Correct term; developers who do 3D know it |
| ghost node | BrewSite's drill-down technique; specific and evocative |
| scroll-driven | Accurately describes the primary interaction model |
| TypeScript-first | Accurate; a feature, not a buzzword |
| edge routing | Correct diagram term |
| architecture walk-through | Presentation use case; clear to technical audience |
| No Three.js in your code | Accurate — Three.js is a peer dep, but developers don't call its APIs |
| presentation | Valid use case word for our audience; use it |

**Avoid these:**

| Word/Phrase | Why Not |
|---|---|
| easy / simple | Insulting to developer intelligence; there is a learning curve |
| powerful | Unmeasurable; say specifically what it does |
| stunning / beautiful / gorgeous | Decorative; trust the visuals |
| seamless | Cliché; means nothing |
| intuitive | Subjective and untestable |
| next-level / next-gen / cutting-edge | Pure filler |
| transform / revolutionize | Creates credibility debt |
| Author in JSX | Use "Author in React" — JSX is syntax; React is the paradigm |
| No Three.js required | False — Three.js IS in peerDependencies; say "No Three.js in your code" |
| presentation-ready | Weak as a headline; acceptable in body copy for the PM audience |
| deserves | Luxury register; paternalistic toward engineers |
| magic | Actively harmful — suggests you shouldn't understand how it works |
| delightful / delighted | Design-speak |
| leverage / utilize | Say "use" |

---

### Code snippet visual treatment

All code snippets across all scenes share the same visual format:

- **Font:** JetBrains Mono, monospace
- **Main code color:** `#00f5ff` (electric cyan)
- **Dimmed elements** (JSX brackets, closing tags, punctuation): `rgba(0,245,255,0.45)`
- **Background:** `rgba(0,245,255,0.04)` with `1px solid rgba(0,245,255,0.15)` border
- **Padding:** 16px
- **Border-radius:** 6px
- **Font size:** `clamp(11px, 1.2vw, 13px)`
- **Line height:** 1.7
- **Position:** Bottom-left by default; left column for two-column layouts
- **Max width:** ~400px
- **Snippet rules:** 5–10 lines max, strict. Real DSL prop names only — no pseudocode. No ellipsis (`...`). No prose comments — label sparingly with `// before` / `// after` at most.

---

## Part 5: Narrative Arc

### 10-scene emotional beat structure

| # | Scene | Emotional job | The realization |
|---|-------|--------------|-----------------|
| 0 | Hero | Intrigue → recognition | "This site is made with the thing it's selling." |
| 1 | Core intro | First proof: here's the authoring surface | "JSX. A diagram. That's it." |
| 2 | Core baked | Second proof: here's the declarative model | "Two states. Compiler handles everything between them." |
| 3 | Model | Visual quality: one tag, PBR character | "That's 4 lines of JSX. It looks like this." |
| 4 | Meeting | Scale shock: 30 characters, procedural | "30 characters from a map. The ratio is absurd." |
| 5 | Simple diagram | Recognition: architecture as code | "I've drawn this in Notion 100 times. Never like this." |
| 6 | Arch overview | Ambition: enterprise scale, still declarative | "16 nodes. 4 tiers. One file." |
| 7 | Arch detail | Technical curiosity: ghost nodes | "Change `opacity`. The transition is automatic." |
| 8 | Combined | Synthesis: both packages, one scene | "Model and diagram in the same React tree. One engine." |
| 9 | GitHub CTA | Clarity + action | "Here's where I start." |

**Note on ecosystem and chart positioning:** The hero badge row (`@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, `@brewsite/chart ↗ soon`) handles all four-package ecosystem awareness. There is no dedicated ecosystem scene. The chart badge in the hero is the only chart awareness on the site until `@brewsite/chart` ships — at which point a dedicated chart scene should be inserted before the combined scene.

---

## Part 6: Scene-by-Scene Copy Specification

**Hard constraint:** `act0/scene_00_hero.tsx` is locked. Do not change it.

All copy below is final. Implement exactly as written.

---

### Scene 1: `act1_act2/scene_01_core_intro.tsx`

**Narrative role:** First content scene after the hero. Shows the authoring surface immediately — the 3D diagram IS the product, and the snippet shows how few lines it takes.

**3D content:** Keep existing hierarchical diagram (Problem → Insight → Decision, neonCyberTheme).

**Code snippet (bottom-left, below headline):**
```tsx
<DiagramCanvas theme={neonCyberTheme}>
  <Diagram id="presentation">
    <HierarchicalLayout direction="top-down" />
    <DiagramNode id="problem"  label="Problem"  icon="ui:exclamation-triangle" />
    <DiagramNode id="insight"  label="Insight"  icon="ui:light-bulb" />
    <DiagramNode id="decision" label="Decision" icon="ui:check-circle" />
    <DiagramEdge from="problem"  to="insight"  flow="forward" />
    <DiagramEdge from="insight"  to="decision" flow="forward" />
  </Diagram>
</DiagramCanvas>
```

**Overlay copy:**

```
Eyebrow:   @brewsite/core

Headline:  Write the scenes.
           The compiler renders the film.

Body:      Conference talk. Investor deck. Product demo.
           You write the story. BrewSite makes it move.
```

**Implementation notes:**
- Change eyebrow from `Presentation Use Case` to `@brewsite/core`
- Change headline from `Start simple: tell one clear story.` to the two lines above
- Change body to the two lines above — names the output formats explicitly
- Add code snippet block below headline, before body, using visual treatment spec
- No mechanism language anywhere in the overlay
- `<HierarchicalLayout direction="top-down" />` is a **child component inside `<Diagram>`**, not a prop on `DiagramCanvas` or `Diagram`. Verified against `apps/website/src/scenes/act1_act2/scene_01_core_intro.tsx` line 50. Import from `@brewsite/diagram`.

---

### Scene 2: `act1_act2/scene_02_core_baked.tsx`

**Narrative role:** Demonstrates the declarative model explicitly. The before/after snippet is the clearest possible proof that you write states and BrewSite generates transitions — without once explaining how.

**3D content:** Keep existing complex multi-group narrative diagram (Context → Narrative → Execution groups, neonCyberTheme). This is demonstrating a more complex compiled scene.

**Code snippet (centered bottom, above tags):**
```tsx
// before
<DiagramNode id="api" label="API Gateway" position={[0, 0, 0]} />

// after
<DiagramNode id="api" label="API Gateway" position={[0, 6, 0]} />
<DiagramEdge from="api" to="db" flow="forward" />
```

**Overlay copy:**

```
Eyebrow:   @brewsite/core

Headline:  Describe the state.
           Ship the transition.

Body:      Author each scene as a JSX snapshot.
           BrewSite animates everything between them.

Tags:      Declarative · Scroll-Driven · TypeScript-First · SSR-Safe · Mobile-Ready
```

**Implementation notes:**
- Change eyebrow from `Slide Two: Build The Full Argument` to `@brewsite/core`
- Change headline from `Go from one idea to stakeholder-ready narrative...` to the two lines above
- Change body to the two lines above
- Add code snippet block above the tag row, using visual treatment spec
- Change tags from `['Narrative First', 'Animate The Why', 'Decision Clarity', 'Technical Depth']` to the five above
- Remove all mechanism explanation — "pre-baked," "O(1)," compiler pipeline — from overlay copy; the snippet shows the mechanism indirectly

---

### Scene 3: `act3_act4/scene_01_model.tsx`

**Narrative role:** Visual quality confirmation. One tag. One fully-lit PBR character. The absurd ratio of snippet length to visual output IS the message.

**3D content:** Keep existing model scene. Keep crowd via `actorElements`. The wide camera framing shows multiple characters — the snippet shows that each one starts with a single `<ModelRouter>`.

**Code snippet (left column, below headline):**
```tsx
<ModelRouter type="Worker" id="worker" scale={6}>
  <Playback>
    <Animation clipName="idle" weight={1} />
  </Playback>
</ModelRouter>
```

**Overlay copy:**

```
Eyebrow:   @brewsite/model

Headline:  One tag.
           One fully lit character.

Body:      Materials, shadows, environment — the renderer handles all of it.
           Drop any GLTF. Animate the world.
```

**Implementation notes:**
- Remove the two-column layout (top-left + top-right)
- Consolidate to single left-aligned overlay block at bottom-left
- Remove the `GLTF · PBR Materials` top-right eyebrow entirely
- New eyebrow: `@brewsite/model`
- New headline: two lines above
- New body: two lines above
- Add code snippet block between headline and body, using visual treatment spec

---

### Scene 4: `act3_act4/scene_02_meeting.tsx`

**Narrative role:** Scale proof. The crowd is the output. The procedural snippet shows exactly how 30 characters come from a map.

**3D content:** Keep exactly as-is. Camera and crowd carry forward from scene_01_model.

**Code snippet (bottom-left, below headline):**
```tsx
{actors.map((a) => (
  <ModelRouter key={a.id} type={a.type}
    id={a.id} position={a.position} scale={6}>
    <Playback>
      <Animation clipName={a.clip} weight={1} />
    </Playback>
  </ModelRouter>
))}
```

**Overlay copy:**

```
Eyebrow:   Procedural Composition

Headline:  30 characters.
           50 lines of JSX.

Body:      Placement. Collision detection. Animation assignment.
           All at author time. Runtime is just playback.
```

**Implementation notes:**
- Keep eyebrow exactly: `Procedural Composition`
- Keep headline exactly: `30 characters. / 50 lines of JSX.`
- Change body last sentence from `not a single conditional` to `Runtime is just playback`
- Add code snippet block between headline and body, using visual treatment spec
- The snippet variable names (`actors`, `a.type`, `a.clip`) refer to the `actorProps` array built in `meetingCharacters.tsx` — the scene-author should match the actual variable references from the existing file

---

### Scene 5: `act5_act6/scene_01_simple_diagram.tsx`

**Narrative role:** Introduce `@brewsite/diagram`. Five lines of JSX, real AWS icons, routed edges. The snippet shows the exact authoring surface.

**3D content:** Keep existing 4-node tech stack diagram (neonCyberTheme, ManualLayout).

**Code snippet (bottom-left, below headline):**
```tsx
<DiagramNode id="api"   label="API Gateway" icon="aws:api-gateway" position={[0, 0, 0]} />
<DiagramNode id="db"    label="PostgreSQL"  icon="aws:rds"         position={[-3, -4, 0]} />
<DiagramNode id="cache" label="Redis"       icon="aws:elasticache" position={[3, -4, 0]} />
<DiagramEdge from="api" to="db"    label="SQL"   flow="forward" />
<DiagramEdge from="api" to="cache" label="Cache" flow="forward" />
```

**Overlay copy:**

```
Eyebrow:   @brewsite/diagram

Headline:  Your architecture slide,
           in a scene.

Body:      Declare nodes and edges in JSX.
           20+ icon namespaces. Auto-layout. Routed edges.
```

**Implementation notes:**
- Change headline from `From whiteboard\nto 3D.` to `Your architecture slide,\nin a scene.`
- Change body from `Themes, icons, routed edges, groups. No Figma required.` to the two lines above
- Add code snippet block between headline and body, using visual treatment spec
- Keep bottom-left position and existing animation structure

---

### Scene 6: `act5_act6/scene_02_arch_overview.tsx`

**Narrative role:** Enterprise scale. 16 nodes, 4 tiers, real groups and swimlanes — still JSX. The snippet shows the group structure.

**3D content:** Keep existing 16-node AWS architecture with darkGlassTheme and floor mirror.

**Code snippet (bottom-left, new addition):**
```tsx
<DiagramGroup id="api-tier" label="API Tier" variant="boundary">
  <DiagramNode id="cdn" label="CloudFront" icon="aws:cloudfront" />
  <DiagramNode id="api" label="API Gateway" icon="aws:api-gateway" />
</DiagramGroup>
<DiagramGroup id="compute" label="Compute" variant="boundary">
  <DiagramNode id="ecs"    label="ECS"    icon="aws:ecs" />
  <DiagramNode id="lambda" label="Lambda" icon="aws:lambda" />
</DiagramGroup>
```

**Overlay copy:**

```
Stat (top-right):     16 nodes · 4 tiers · 8 edges

Headline (bottom-left):   Your production
                           architecture,
                           in a scene.

Body (below headline):    Groups, swimlanes, nested tiers — all declared.
                          Ready for your next deck, demo, or keynote.
```

**Implementation notes:**
- Keep top-right stat `16 nodes · 4 tiers · 8 edges` exactly
- Remove `Production Architecture` eyebrow from top-right (the stat is self-describing)
- Change bottom-left headline from `Architecture diagrams.\nPresentation-ready.` to the three lines above
- Add body below headline: two lines above
- Add code snippet block between headline and body, using visual treatment spec
- Body style: `clamp(13px, 1.5vw, 15px)`, `rgba(240,246,252,0.6)`, `lineHeight: 1.6`

---

### Scene 7: `act5_act6/scene_03_arch_detail.tsx`

**Narrative role:** The toolkit's most impressive capability — drill-down with ghost nodes. The before/after snippet shows exactly what the authoring surface looks like: set `opacity={0.3}` on the nodes that recede.

**3D content:** Keep the ghost-node drill-down exactly as authored.

**Code snippet (bottom-right, replacing the jargon list):**
```tsx
// before
<DiagramNode id="cdn" position={[0,  2, -25]} opacity={0.3} />
<DiagramNode id="api" position={[0, -4, -25]} opacity={0.3} />

// after
<DiagramNode id="ecs"     label="ECS Cluster" position={[-5, -8, -5]} />
<DiagramNode id="svc-api" label="API Service" position={[-5, -6,  8]} />
```

**Overlay copy:**

```
Eyebrow (right):   Drill down. Stay in the scene.

Headline (right):  Click a group.
                   Zoom to the detail.
                   Ghost the rest.

Code snippet (below headline, right)

Body (below snippet):   The context stays visible. The focus shifts.
                        One scene system. Infinite depth.
```

**Implementation notes:**
- Keep eyebrow `Drill down. Stay in the scene.` exactly — it is the best line on the site
- Add headline before the body (currently only eyebrow + body): three lines above
- Replace body dot-list `DiagramGroups · Focus Regions · Theme System` with the prose lines above
- Add code snippet block between headline and body, using visual treatment spec
- Headline style: `clamp(18px, 2.5vw, 22px)`, weight 600, `#f0f6fc`

---

### Scene 8: `act7/scene_02_combined.tsx`

**Narrative role:** The proof. Models AND diagrams in the same compiled scene — one EngineProvider, one React tree, one scroll interaction. The snippet shows both packages composing together.

**⚠️ `ModelRouter` is imported but no `<ModelRouter>` DSL element is placed in the scene. The eyebrow claims "Models + Diagrams" but there are no characters. This must be fixed.**

**3D content fix required:** Add a `<ModelRouter>` element — a worker character positioned to the LEFT of the diagram. Approximate position: `position={[-12, 0, 5]}` with idle animation.

**Code snippet (bottom-left, below headline):**
```tsx
<ModelRouter type="Worker" id="character"
  position={[-12, 0, 5]} scale={6}>
  <Playback>
    <Animation clipName="idle" weight={1} />
  </Playback>
</ModelRouter>
<DiagramCanvas theme={darkGlassTheme}>
  <DiagramNode id="api" label="API Server" icon="aws:api-gateway" />
  <DiagramEdge from="api" to="db" flow="forward" />
</DiagramCanvas>
```

**Overlay copy:**

```
Eyebrow:   Models + Diagrams + React

Headline:  Web apps. Decks.
           Pitches. Marketing sites.

Body:      One EngineProvider. Everything compiled.
           TypeScript end to end.
```

**Implementation notes:**
- Wire into `websiteFlowScenes` (after scene_03_arch_detail)
- Add `<ModelRouter>` DSL element with `<Playback><Animation /></Playback>` children
- Change eyebrow from `Models + Diagrams + HUD + React` to `Models + Diagrams + React`
- Keep headline `Web apps. Decks.\nPitches. Marketing sites.` exactly
- Update body to the two lines above
- Add code snippet block between headline and body, using visual treatment spec

---

### Scene 9: `act8/scene_01_github.tsx`

**Narrative role:** The payoff. You've seen what it does. Here's where you start. The terminal card IS the code snippet.

**3D content:** Keep as-is (minimal lighting, CSS terminal card). The terminal is the code.

**Overlay copy:**

```
Terminal:  $ pnpm add @brewsite/core @brewsite/model @brewsite/diagram
           added 3 packages in 1.2s

Headline:  Open Source. Production Ready.

Body:      Built for TypeScript. Powered by React.
           The engine is @brewsite/core. The rest is what your story needs.

CTA:       ★ Star on GitHub →
```

**Implementation notes:**
- Wire into `websiteFlowScenes` (last scene)
- Change body last sentence from `Install the engine, then add only what your story needs.` to `The engine is @brewsite/core. The rest is what your story needs.`
- Keep all other copy exactly as-is
- Nav label: `Get Started`

---

## Part 7: Complete Copy Reference

All 9 content scenes (excluding locked hero) with final copy.

| Scene | Eyebrow | Headline | Body |
|-------|---------|----------|------|
| scene_01_core_intro | `@brewsite/core` | `Write the scenes. / The compiler renders the film.` | `Conference talk. Investor deck. Product demo. / You write the story. BrewSite makes it move.` |
| scene_02_core_baked | `@brewsite/core` | `Describe the state. / Ship the transition.` | `Author each scene as a JSX snapshot. / BrewSite animates everything between them.` |
| scene_01_model | `@brewsite/model` | `One tag. / One fully lit character.` | `Materials, shadows, environment — the renderer handles all of it. / Drop any GLTF. Animate the world.` |
| scene_02_meeting | `Procedural Composition` | `30 characters. / 50 lines of JSX.` | `Placement. Collision detection. Animation assignment. / All at author time. Runtime is just playback.` |
| scene_01_simple_diagram | `@brewsite/diagram` | `Your architecture slide, / in a scene.` | `Declare nodes and edges in JSX. / 20+ icon namespaces. Auto-layout. Routed edges.` |
| scene_02_arch_overview | `16 nodes · 4 tiers · 8 edges` (stat, top-right) | `Your production / architecture, / in a scene.` | `Groups, swimlanes, nested tiers — all declared. / Ready for your next deck, demo, or keynote.` |
| scene_03_arch_detail | `Drill down. Stay in the scene.` (eyebrow) | `Click a group. / Zoom to the detail. / Ghost the rest.` | `The context stays visible. The focus shifts. / One scene system. Infinite depth.` |
| scene_02_combined | `Models + Diagrams + React` | `Web apps. Decks. / Pitches. Marketing sites.` | `One EngineProvider. Everything compiled. / TypeScript end to end.` |
| scene_01_github | `Open Source. Production Ready.` (headline) | Terminal card | `Built for TypeScript. Powered by React. / The engine is @brewsite/core. The rest is what your story needs.` |

---

## Part 8: websiteFlowScenes Rewrite

### Required new scene order

```typescript
// apps/website/src/scenes/websiteFlow.tsx

export const websiteFlowScenes: JSX.Element[] = [
  scene00Hero,          // act0         — LOCKED
  scene01CoreIntro,     // act1_act2    — updated copy + code snippet
  scene02CoreBaked,     // act1_act2    — updated copy + code snippet
  scene01ModelWide,     // act3_act4    — updated copy + consolidated overlay + code snippet
  scene02Meeting,       // act3_act4    — minor body update + code snippet
  scene01SimpleDiagram, // act5_act6    — updated headline + code snippet
  scene02ArchOverview,  // act5_act6    — updated headline + body + code snippet
  scene03ArchDetail,    // act5_act6    — updated body + code snippet
  scene02Combined,      // act7         — ADD THIS, add ModelRouter element, code snippet
  scene01Github,        // act8         — ADD THIS, minor body update
];
```

### Required nav target updates

```typescript
export const websiteNavTargets: WebsiteNavTarget[] = [
  { num: '00', label: 'BrewSite',       sceneId: 'website-hero-00' },
  { num: '01', label: 'The Engine',     sceneId: 'website-presentation-01' },
  { num: '02', label: 'How It Works',   sceneId: 'website-presentation-02' },
  { num: '03', label: 'Models',         sceneId: 'website-model-01' },
  { num: '04', label: 'At Scale',       sceneId: 'website-meeting-01' },
  { num: '05', label: 'Diagrams',       sceneId: 'website-diagram-simple' },
  { num: '06', label: 'Architecture',   sceneId: 'website-arch-overview' },
  { num: '07', label: 'Drill-Down',     sceneId: 'website-arch-detail' },
  { num: '08', label: 'Full Stack',     sceneId: 'website-full-02' },
  { num: '09', label: 'Get Started',    sceneId: 'website-github-01' },
];
```

### Scenes removed from the flow

These scenes exist on disk but are no longer wired into `websiteFlowScenes`:

| Scene | Reason |
|-------|--------|
| `act1_act2/scene_03_ecosystem.tsx` | Text-only package cards, no live 3D demo, no code pairing possible. Ecosystem awareness handled by hero badge row. |
| `act7/scene_01_foundation.tsx` | Pure synthesis narrative, empty room, no unique 3D content to pair with code. "One engine" message lands on the combined scene. |
| `act6_chart/scene_01_chart_teaser.tsx` | `@brewsite/chart` not yet shipped; cannot pair live demo with working code honestly. Chart awareness handled by `@brewsite/chart ↗ soon` badge in hero. Add a real chart scene when the package ships. |

---

## Part 9: Chart Positioning

`@brewsite/chart` awareness on the current site is handled entirely by the hero badge row:

```tsx
<span className="hero-package-badge hero-package-badge--soon">
  @brewsite/chart
  <span className="hero-package-badge__soon-label">↗ soon</span>
</span>
```

Do not add additional chart copy, teasers, or "coming soon" sections anywhere in the flow. The badge is sufficient. It sets expectations without over-promising.

### When @brewsite/chart ships

Insert a dedicated chart scene immediately before `scene_02_combined`. Recommended scene ID: `website-chart-01`. The scene should show a real `<Chart>` element — not an ImagePanel with a mockup — with a 5–8 line snippet showing the chart DSL. The headline: **"The bars cast shadows. Because they're real."**

Recommended first demo data: quarterly revenue, two grouped series, 4 bars per group. darkGlassTheme colors. Floor mirror. Camera at a slightly non-orthographic angle to make bar depth visible.

---

## Part 10: Implementation Priority

### Priority 1 — Critical (site is structurally broken without these)

| # | Change | File |
|---|--------|------|
| 1 | Wire scene02Combined into websiteFlowScenes | `websiteFlow.tsx` |
| 2 | Wire scene01Github into websiteFlowScenes | `websiteFlow.tsx` |
| 3 | Remove scene03Ecosystem, scene01Foundation, scene01ChartTeaser from flow | `websiteFlow.tsx` |
| 4 | Reorder all scenes per proposed order above | `websiteFlow.tsx` |
| 5 | Update nav labels per proposed targets above | `websiteFlow.tsx` |
| 6 | Add `<ModelRouter>` element to scene_02_combined (eyebrow claims "Models" but no model exists) | `scene_02_combined.tsx` |

### Priority 2 — High (code snippets are the new centerpiece of every scene)

| # | Change | File |
|---|--------|------|
| 7 | Add code snippet to scene_01_core_intro | `scene_01_core_intro.tsx` |
| 8 | Add code snippet to scene_02_core_baked | `scene_02_core_baked.tsx` |
| 9 | Add code snippet to scene_01_model, consolidate overlay layout | `scene_01_model.tsx` |
| 10 | Add code snippet to scene_02_meeting | `scene_02_meeting.tsx` |
| 11 | Add code snippet to scene_01_simple_diagram | `scene_01_simple_diagram.tsx` |
| 12 | Add code snippet to scene_02_arch_overview | `scene_02_arch_overview.tsx` |
| 13 | Add code snippet to scene_03_arch_detail | `scene_03_arch_detail.tsx` |
| 14 | Add code snippet to scene_02_combined | `scene_02_combined.tsx` |

### Priority 3 — Medium (copy changes to align with new messaging)

| # | Change | File |
|---|--------|------|
| 15 | Rewrite scene_01_core_intro overlay copy | `scene_01_core_intro.tsx` |
| 16 | Rewrite scene_02_core_baked overlay copy + tags | `scene_02_core_baked.tsx` |
| 17 | Rewrite scene_01_model overlay copy, consolidate to single column | `scene_01_model.tsx` |
| 18 | Update scene_02_meeting body copy | `scene_02_meeting.tsx` |
| 19 | Update scene_01_simple_diagram headline + body | `scene_01_simple_diagram.tsx` |
| 20 | Update scene_02_arch_overview headline + add body | `scene_02_arch_overview.tsx` |
| 21 | Update scene_03_arch_detail: add headline, replace dot-list body | `scene_03_arch_detail.tsx` |
| 22 | Update scene_02_combined eyebrow + body | `scene_02_combined.tsx` |
| 23 | Update scene_01_github body last sentence | `scene_01_github.tsx` |
