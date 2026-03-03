---
title: "Website Content Rewrite Proposal — Scene-by-Scene"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-03
---

# Website Content Rewrite Proposal — Scene-by-Scene

This document is the authoritative content specification for the BrewSite marketing website rewrite. It covers every scene except `act0/scene_00_hero.tsx` (locked). A developer or scene author should be able to implement every change in this document without asking any clarifying questions.

---

## Part 1: Current State Analysis

### What the website currently says (and why it fails)

#### Wiring gap — four scenes are written but never shown

`apps/website/src/scenes/websiteFlow.tsx` exports `websiteFlowScenes`, which contains only 8 scenes:
```
hero → core intro → core baked → simple diagram → arch overview → arch detail → model → meeting
```

**Four complete scenes are never wired in and therefore never seen by visitors:**
- `scene03Ecosystem.tsx` — the four-package overview ("One engine. Four packages.")
- `scene01Foundation.tsx` — the full-stack intro ("One engine. Infinite forms.")
- `scene02Combined.tsx` — model + diagram together
- `scene01Github.tsx` — install command and GitHub CTA

This means the website currently has no GitHub CTA, no ecosystem overview, and no full-stack climax. Visitors scroll to the meeting scene and then the page ends. This is the single most impactful structural defect.

---

### Scene-by-scene current state

#### scene_01_core_intro.tsx (currently wired as Scene 2)

**3D content:** A small 3-node hierarchical diagram: Problem → Insight → Decision. neonCyberTheme.

**Current overlay copy:**
- Eyebrow: `Presentation Use Case`
- Headline: `Start simple: tell one clear story.`
- Body: `For technical PMs and architects, this is the fastest way to explain problem, context, and proposed direction in one visual pass.`

**Problems:**
1. **Catastrophic positioning error.** This scene positions BrewSite as "a tool for making presentation slides for PMs." A developer landing on this after the hero will think BrewSite is a competitor to Pitch, Tome, or Beautiful.ai. The product is a React SDK for 3D web experiences. This is the first content scene after the hero and it fails to explain what BrewSite is.
2. The audience described ("technical PMs and architects") is the toolkit's *buyer*, not what the toolkit *is*.
3. "Start simple" implies there is complexity to manage, which undermines the "declarative" promise.
4. No mention of React, scroll-driven scenes, compiler, or any core technical differentiator.

---

#### scene_02_core_baked.tsx (currently wired as Scene 3)

**3D content:** A complex multi-group hierarchical diagram with groups: Context (Audience, Constraints), Narrative (Problem, Tradeoffs, Proposal, Decision), Execution (Risks, Owners). Many flowing edges with labels.

**Current overlay copy:**
- Eyebrow: `Slide Two: Build The Full Argument`
- Headline: `Go from one idea to stakeholder-ready narrative without leaving the same scene system.`
- Tags: `Narrative First · Animate The Why · Decision Clarity · Technical Depth`

**Problems:**
1. "Slide Two" implies this is the second slide in a presentation template. The visitor is now deep in a confusion spiral: they think BrewSite is a slide deck tool.
2. "Stakeholder-ready narrative" is B2B presentation language. This is a toolkit README, not a sales deck.
3. The tags (`Narrative First`, `Animate The Why`, `Decision Clarity`) are content strategy jargon that describes a presentation methodology, not a developer SDK.
4. The 3D diagram is complex and impressive but illustrates the wrong use case — it's showing BrewSite *being used to make a PM's presentation* rather than *how BrewSite works*.

**The core miss:** Acts 1 and 2 together demonstrate one thing: "BrewSite can be used to build presentation-style diagram animations for business stakeholders." What they should demonstrate: "BrewSite is a React toolkit that compiles JSX scene declarations into scroll-driven 3D animations."

---

#### scene_03_ecosystem.tsx (NOT WIRED — never seen)

**3D content:** Dark background, no geometry. Four package cards in a 2×2 grid.

**Current overlay copy:**
- Eyebrow: `The Ecosystem`
- Headline: `One engine. Four packages.`
- Cards: `@brewsite/core` (The engine. Declarative. Pre-baked. O(1).), `@brewsite/model` (GLTF models. Characters, animations, PBR materials.), `@brewsite/diagram` (3D diagrams. Architecture, flows, systems. Themes and routed edges.), `@brewsite/chart` (Data stories. Charts and visualizations in 3D. ↗ coming soon)
- Footer: `Install only what you need. All packages share the same declarative scene model.`

**Assessment:** This is actually well-written and on-brand. The problem is it's not wired into the flow. This scene needs to be placed after the core engine scenes.

**Minor issues:**
- `@brewsite/chart` body text `Charts and visualizations in 3D.` undersells the native 3D geometry approach (D3 math → Three.js, not canvas textures).
- `3D diagrams. Architecture, flows, systems.` should be snappier.

---

#### scene_01_model.tsx (currently wired as Scene 7 — "model")

**3D content:** Imports `{actorElements}` from `./meetingCharacters`. This is the same crowd of characters used in the meeting scene. This is NOT a focused single-model showcase — it is the meeting crowd.

**Current overlay copy:**
- Top-left eyebrow: `@brewsite/model`
- Top-left headline: `Drop a GLTF. Animate the world.`
- Top-right eyebrow: `GLTF · PBR Materials`
- Top-right content: `Physically Based. Floor-to-ceiling.` + `Metalness, roughness, normals — the renderer handles it. You handle the story.`

**Problems:**
1. The 3D content (crowd) does not match the "drop a GLTF" message. Visitors see dozens of characters and may not appreciate that each is individually loaded and animated.
2. The copy is split across top-left and top-right, creating visual competition.
3. `Floor-to-ceiling` is unclear — does it mean "fully featured"? It's not a common idiom.
4. The scene should feature a single hero robot or worker character shown clearly with PBR materials visible — showing reflections, metalness, normals. Not a crowd.

---

#### scene_02_meeting.tsx (currently wired as Scene 8 — last scene)

**3D content:** Same `{actorElements}` crowd as scene_01_model.

**Current overlay copy:**
- Eyebrow: `Procedural Composition`
- Headline: `30 characters. 50 lines of JSX.`
- Body: `Random placement, collision detection, animation assignment — all at author time. Runtime is just playback.`

**Assessment:** This is the best scene on the website. The headline is specific and credible. The body explains the mechanism clearly. The only issue is that it appears *after* the model scene, so the visitor sees the same crowd twice in a row — the visual novelty is gone. The meeting scene should come after a distinct single-model scene, not directly adjacent to one using the same actorElements.

---

#### scene_01_simple_diagram.tsx (currently wired as Scene 4)

**3D content:** 4-node tech stack: React App → API Gateway → PostgreSQL + Redis. neonCyberTheme. Flowing edges.

**Current overlay copy:**
- Eyebrow: `@brewsite/diagram`
- Headline: `From whiteboard to 3D.`
- Body: `Themes, icons, routed edges, groups. No Figma required.`

**Assessment:** Structurally fine. The headline "From whiteboard to 3D" is memorable. The body is a feature list and misses the benefit. "No Figma required" is a negative claim. The diagram itself is a strong 3D visualization but the scene order in the current flow (scene 4 — appearing before the model/crowd scenes) is wrong. Diagrams should come after the core engine and model demonstrations.

---

#### scene_02_arch_overview.tsx (currently wired as Scene 5)

**3D content:** 16-node AWS architecture diagram with 4 groups (Client Tier, API Tier, Compute Tier, Data Tier). darkGlassTheme. Floor mirror.

**Current overlay copy:**
- Top-right eyebrow: `Production Architecture`
- Top-right stat: `16 nodes · 4 tiers · 8 edges`
- Bottom-left headline: `Architecture diagrams. Presentation-ready.`

**Problems:**
1. "Presentation-ready" echoes the Act 1 positioning error — this is the third time the word "presentation" appears.
2. The stat (`16 nodes · 4 tiers · 8 edges`) is interesting but positioned top-right where it reads like an afterthought.
3. The headline is passive. "Architecture diagrams. Presentation-ready." says what it is, not what it does for the developer.
4. No body copy at all explaining the value.

---

#### scene_03_arch_detail.tsx (currently wired as Scene 6)

**3D content:** Drill-down to ECS cluster detail. Ghost nodes at 0.3 opacity in Z-recessed space. New service nodes for Auth, API, Worker.

**Current overlay copy:**
- Eyebrow: `Drill down. Stay in the scene.`
- Body: `DiagramGroups · Focus Regions · Theme System`

**Assessment:** "Drill down. Stay in the scene." is the most effective line on the entire site. It communicates the key interaction capability precisely. The body, however, is raw feature names with dot-separators — pure jargon. No developer will understand "Focus Regions" from this alone.

---

#### scene_01_foundation.tsx (NOT WIRED — never seen)

**3D content:** A floor mirror and directional lights. No geometry. Literally an empty dark room.

**Current overlay copy:**
- Eyebrow: `BrewSite`
- Headline: `One engine. Infinite forms.`

**Problems:**
1. Not wired.
2. Even if it were wired, it shows nothing. The "full stack" intro should show something three-dimensional.
3. "BrewSite" as an eyebrow is circular — we already know we're on the BrewSite site.

---

#### scene_02_combined.tsx (NOT WIRED — never seen)

**3D content:** Architecture diagram (4 nodes) + floor mirror. `ModelRouter` is imported but **no `<Model>` DSL element is actually placed in the scene.** There are no characters in the 3D space.

**Current overlay copy:**
- Eyebrow: `Models + Diagrams + HUD + React`
- Body: `Web apps. Decks. Pitches. Marketing sites.`

**Problems:**
1. Not wired.
2. The eyebrow claims "Models" but there is no model in the scene. ModelRouter is imported but unused.
3. "Web apps. Decks. Pitches. Marketing sites." is a list of output formats but doesn't sell why BrewSite is the choice for any of them.

---

#### scene_01_github.tsx (NOT WIRED — never seen)

**3D content:** Minimal lighting. The content is pure CSS terminal card + CTA block.

**Current overlay copy:**
- Terminal: `pnpm add @brewsite/core @brewsite/model @brewsite/diagram`
- Headline: `Open Source. Production Ready.`
- Body: `Built for TypeScript. Powered by React. Install the engine, then add only what your story needs.`
- CTA: `Star on GitHub →`

**Assessment:** Well-written and clean. The terminal command is correct. The only issue is it's not wired — visitors never reach it.

---

## Part 2: Proposed Narrative Arc

The website should tell a single coherent technical story in five acts:

**Act I — What it is** (Scenes 1–2): BrewSite is a React toolkit. Scenes are JSX. The compiler handles everything. It's fast because it pre-bakes everything to a flat array at startup.

**Act II — The full ecosystem** (Scene 3): One engine, four packages, install only what you need.

**Act III — The first capability: models** (Scenes 4–5): Load any GLTF. Get PBR materials, animations, and a reflective floor for free. Then: procedural composition at scale.

**Act IV — The second capability: diagrams** (Scenes 6–8): From a simple tech stack to a full AWS architecture to a drill-down reveal — all in the same scene system.

**Act V — Everything together** (Scenes 9–10 + CTA): A single-character model plus a diagram plus a React overlay in one compiled scene. Then the install command.

**Missing capability: charts** — Act V should also include or preview the chart capability. Since @brewsite/chart is not yet shipped, the most honest approach is to add a dedicated chart teaser scene between Act IV and Act V showing what the chart package will look like, clearly labeled "coming soon."

---

## Part 3: Scene-by-Scene Rewrite

Each entry below specifies:
- **File** — exact file path
- **Current issues** — brief problem statement
- **Proposed eyebrow** — exact text
- **Proposed headline** — exact text
- **Proposed body** — exact text (2–4 lines)
- **Tags** (if applicable) — exact text
- **3D content** — what should be shown
- **Why this scene matters** — its role in the narrative arc
- **Implementation notes** — specific changes to make

---

### Scene 1: `act1_act2/scene_01_core_intro.tsx`

**Role in narrative:** This is the first content scene after the hero. It must answer: "What is BrewSite?" in the clearest possible terms, for a TypeScript developer.

**Current issues:** Positions BrewSite as a PM presentation tool. Complete messaging failure.

**3D content:** Keep the existing hierarchical diagram (Problem → Insight → Decision with neonCyberTheme). This is a good visual showcase of the diagram capability and the glowing edges look excellent. The issue is purely the overlay copy framing it as a "use case for PMs" rather than "a demonstration of the toolkit."

**Proposed overlay copy:**

```
Eyebrow:       @brewsite/core

Headline:      Scenes as React.
               Rendered like film.

Body:          Describe each state in JSX.
               The compiler builds all the transitions.
               No animation loops. No frame math. No Three.js required.
```

**Tags:** Remove existing tags entirely. No tags in this scene.

**Why this matters:** After the hero, the visitor needs a clear statement of the authoring model. "Scenes as React" is the central claim — you write JSX, the toolkit handles everything else. The three body lines answer "how?" in concrete terms.

**Implementation notes:**
- Change eyebrow from `Presentation Use Case` to `@brewsite/core`
- Change headline from `Start simple: tell one clear story.` to `Scenes as React.\nRendered like film.`
- Change body from current text to the three lines above
- Keep existing headline gradient style (`linear-gradient(135deg, #f0f6fc 0%, #aaccff 100%)`)
- Keep MidFade + ScrollOn animation structure
- Keep the diagram 3D content as-is — it's demonstrating the library working, which is now the correct framing

---

### Scene 2: `act1_act2/scene_02_core_baked.tsx`

**Role in narrative:** Deepen the "how." Scene 1 says what BrewSite is. Scene 2 explains the architectural mechanism that makes it fast and unique: pre-baked track, O(1) sampling, SSR-safe.

**Current issues:** "Slide Two: Build The Full Argument" — positions this as a presentation tool. Tags describe presentation methodology, not SDK properties.

**3D content:** The complex multi-group narrative diagram is visually impressive and demonstrates diagram groups well. Keep it. The copy reframe turns it from "a PM presentation template" into "an example of a compiled scene with multiple groups and animated edges."

**Proposed overlay copy:**

```
Eyebrow:       Pre-baked. O(1) playback.

Headline:      Declare states.
               The compiler handles the rest.

Body:          Author time: the compiler bakes every transition to a flat array.
               Playback time: one array lookup per frame.
               Scroll position → tick index → Three.js state. That's it.
```

**Tags (replaces existing tags):**
```
Declarative · Pre-Baked · O(1) Sampling · SSR-Safe · TypeScript-First · Scroll-Driven
```

**Why this matters:** The pre-baked O(1) architecture is the core technical differentiator of BrewSite vs. every other animation library. Theatre.js re-evaluates curves each frame. GSAP runs callbacks. BrewSite compiles once, then runs at constant time regardless of scene complexity. This is a real technical innovation and the website should explain it.

**Implementation notes:**
- Change eyebrow from `Slide Two: Build The Full Argument` to `Pre-baked. O(1) playback.`
- Change headline `<p>` content to: `Declare states.\nThe compiler handles the rest.`
- Change body text entirely to the three-line explanation
- Change tags from `['Narrative First', 'Animate The Why', 'Decision Clarity', 'Technical Depth']` to `['Declarative', 'Pre-Baked', 'O(1) Sampling', 'SSR-Safe', 'TypeScript-First', 'Scroll-Driven']`
- Keep tag styles exactly as-is (they look correct)
- Keep ScrollOn delay structure for the tags

---

### Scene 3: `act1_act2/scene_03_ecosystem.tsx`

**Role in narrative:** After explaining what the engine is and how it works, introduce the full four-package ecosystem. This is the product map.

**Current issues:** Scene is NOT in websiteFlowScenes. Must be added. Content is largely correct but `@brewsite/chart` card is weak.

**Proposed overlay copy — unchanged sections:**
```
Eyebrow:       The Ecosystem
Headline:      One engine. Four packages.
Footer:        Install only what you need. All packages share the same declarative scene model.
```

**Proposed card copy — exact text for each card:**

```
Card 1: @brewsite/core
Headline:  The engine.
Body:      Declarative scenes. Pre-baked transitions. O(1) playback.

Card 2: @brewsite/model
Headline:  GLTF models.
Body:      Characters, animations, PBR materials. Drop in any GLTF asset.

Card 3: @brewsite/diagram
Headline:  3D diagrams.
Body:      Nodes, edges, groups, themes. Architecture to presentation.

Card 4: @brewsite/chart  [COMING SOON badge]
Headline:  Data in 3D.
Body:      Native Three.js geometry. D3 math. Real bars, real tubes, real spheres.
```

**Why "Data in 3D" not "Data stories":** "Data stories" is abstract. "Data in 3D" is concrete — it communicates that the charts are actual Three.js geometry, not canvas textures. This matches the architectural reality of the package (D3 math → Three.js geometry, not CanvasTexture).

**Why this matters:** Visitors have now seen the engine explained. Now they need to understand the scope — four packages, modular, composable. This scene converts "I understand what BrewSite does" into "I understand what I need to install."

**Implementation notes:**
- Update `@brewsite/chart` body from `Charts and visualizations in 3D.` to `Native Three.js geometry. D3 math. Real bars, real tubes, real spheres.`
- Update `@brewsite/diagram` body from `Architecture, flows, systems. Themes and routed edges.` to `Nodes, edges, groups, themes. Architecture to presentation.`
- **Wire this scene into websiteFlowScenes.tsx** — add after scene02CoreBaked

---

### Scene 4: `act3_act4/scene_01_model.tsx`

**Role in narrative:** First demonstration of @brewsite/model. Show one hero GLTF character with clearly visible PBR materials and a floor mirror reflection.

**Current issues:** Uses `{actorElements}` (the meeting crowd) instead of a single focused model. The hero/bot model should be center-frame, clearly showing metalness/roughness/normal map quality with environment lighting. The crowd cannot demonstrate PBR materials — there are too many objects competing for attention.

**3D content:** This scene needs a single Worker or Bot character, centered, with:
- Clear reflective floor mirror
- Good environment lighting that shows material quality (metalness, glossiness)
- Possibly slow rotation or idle animation

Since the website uses characters from `meetingCharacters.ts`, the model scene should either:
a) Show a single isolated character with a close-up camera, or
b) Keep the crowd but reframe the narrative entirely as "models are just components you place" rather than "here is our PBR renderer"

**Recommended approach: keep the crowd, reframe entirely** (lower implementation risk):

**Proposed overlay copy:**

```
Eyebrow:       @brewsite/model

Headline (top-left):  Every character
                      is a GLTF.

Body (top-left):      Register the asset. Place the model.
                      Assign any animation clip in the DSL.
                      PBR materials, shadows, and floor reflections
                      come from the renderer — not your code.
```

**Remove the top-right "GLTF · PBR Materials" duplicate block entirely.** Put all copy on the left side to avoid visual competition.

**Alternative headline if camera is zoomed to a single character:**
```
Headline:  One file, one tag,
           one fully lit 3D character.

Body:      <Model id="worker" position={[0, 0, 0]} />
           That's the authoring surface.
           The renderer handles metalness, roughness,
           normals, shadows, and environment maps.
```

**Why this matters:** After the ecosystem overview, the visitor needs to see what `@brewsite/model` actually looks like in practice. The promise is "drop a GLTF, get a production-quality 3D character." This scene must make that promise visually.

**Implementation notes:**
- Replace two-column overlay (top-left + top-right) with single left-aligned overlay
- Remove the `GLTF · PBR Materials` top-right block
- New eyebrow: `@brewsite/model`
- New headline: `Every character\nis a GLTF.`
- New body: the four lines above
- Keep existing camera positions and floor mirror
- If possible, adjust `actorElements` to show fewer characters more prominently for this scene, or add camera to frame a single worker

---

### Scene 5: `act3_act4/scene_02_meeting.tsx`

**Role in narrative:** Scale demo. One character is easy. Thirty characters, procedurally placed with collision detection, authored in 50 lines of JSX — that's the multiplier.

**Current issues:** None — this is the best-positioned scene on the website. Copy is specific and credible. Minor refinements only.

**Proposed overlay copy (minimal changes):**

```
Eyebrow:       Procedural Composition

Headline:      30 characters.
               50 lines of JSX.

Body:          Placement. Collision detection. Animation assignment.
               All computed at author time.
               Runtime is pure playback — not a single conditional.
```

**Change from current:** Replace `"all at author time. Runtime is just playback."` with `"All computed at author time.\nRuntime is pure playback — not a single conditional."` The phrase "not a single conditional" is precise and developer-credible.

**Why this matters:** This scene closes the @brewsite/model act with a claim about scale that's only possible because of the pre-baked architecture. It implicitly reinforces Scene 2's technical point: compile time does the work, runtime is O(1).

**Implementation notes:**
- Change body's last sentence from `Runtime is just playback.` to `Runtime is pure playback — not a single conditional.`
- No other changes

---

### Scene 6: `act5_act6/scene_01_simple_diagram.tsx`

**Role in narrative:** Introduce @brewsite/diagram with the simplest possible example — a 4-node tech stack. This is "here's what a diagram looks like in 60 seconds."

**Current issues:** "From whiteboard to 3D." is good. "No Figma required" is a negative claim. Body is a feature list.

**Proposed overlay copy:**

```
Eyebrow:       @brewsite/diagram

Headline:      Any graph.
               Five lines of JSX.

Body:          <DiagramNode>, <DiagramEdge>, a theme.
               Automatic layout. Routed edges. 20+ icon namespaces.
               The same declarative model as everything else.
```

**Alternative headline (simpler):**
```
Headline:      From JSX to
               3D in one file.
```

**Preferred:** "Any graph. Five lines of JSX." — it's specific and provocative. Developers will want to see if that claim is real.

**Why this matters:** This is the first diagram scene. The visitor has seen the core engine and models. Now diagrams. The key message is continuity: it's the same `<Scene>` wrapper, the same authoring model, just different children.

**Implementation notes:**
- Change eyebrow from `@brewsite/diagram` to `@brewsite/diagram` (no change)
- Change headline from `From whiteboard\nto 3D.` to `Any graph.\nFive lines of JSX.`
- Change body from `Themes, icons, routed edges, groups. No Figma required.` to the three lines above
- Keep ScrollOn animations

---

### Scene 7: `act5_act6/scene_02_arch_overview.tsx`

**Role in narrative:** Scale the diagram story. From a 4-node stack to a 16-node production AWS architecture with groups, swimlanes, and tier labels. This is what BrewSite diagrams look like at enterprise scale.

**Current issues:** "Presentation-ready" echoes the Act 1 mistake. The stat (16 nodes etc.) is there but not connected to a compelling claim. No body copy.

**Proposed overlay copy:**

```
Eyebrow (top-right):   16 nodes · 4 tiers · 8 edges

Headline (bottom-left): Your production
                         architecture,
                         in a scene.

Body (bottom-left):     Groups, swimlanes, and nested tiers.
                        Every node positioned, every edge routed —
                        automatically, at compile time.
```

**Why this matters:** This scene needs to answer: "Why would I use BrewSite instead of Mermaid or draw.io?" The answer is: because BrewSite diagrams are 3D objects in a rendered scene with PBR materials, animations, and interactive focus regions. "Your production architecture, in a scene" says this clearly.

**Implementation notes:**
- Keep top-right eyebrow position
- Change top-right stat label from `Production Architecture` to nothing (the stat speaks for itself)
- Keep stat text `16 nodes · 4 tiers · 8 edges`
- Change bottom-left from `Architecture diagrams.\nPresentation-ready.` to `Your production\narchitecture,\nin a scene.`
- Add body text below the headline: `Groups, swimlanes, and nested tiers.\nEvery node positioned, every edge routed —\nautomatically, at compile time.`
- Use `clamp(13px, 1.5vw, 15px)` for body text, `rgba(240,246,252,0.6)` color

---

### Scene 8: `act5_act6/scene_03_arch_detail.tsx`

**Role in narrative:** The diagram's party trick — drill-down. Ghost nodes fade to 30% opacity while the ECS cluster expands to show internal microservices. This demonstrates the ghost-node pattern, `mergeSnapshot`, and the focus region capability.

**Current issues:** "Drill down. Stay in the scene." is excellent — keep it exactly. The body "DiagramGroups · Focus Regions · Theme System" is jargon.

**Proposed overlay copy:**

```
Eyebrow (right):   Drill down. Stay in the scene.

Headline (right):  Click a group.
                   Zoom to the detail.
                   Ghost the rest.

Body (right):      The ghost-node pattern: declare only what changes.
                   Previous scene nodes carry forward at reduced opacity.
                   One scene system, infinite depth.
```

**Why the current eyebrow becomes the semantic focus:** "Drill down. Stay in the scene." is so good it should be the conceptual anchor, not just the eyebrow label. The headline then unpacks the three-beat animation sequence (click → zoom → ghost) and the body explains the mechanism.

**Why this matters:** This is the most technically impressive diagram capability on the site. It deserves copy that makes the mechanism clear, not a dot-separated feature list.

**Implementation notes:**
- Change eyebrow from `Drill down. Stay in the scene.` to... keep it
- Change body from `DiagramGroups · Focus Regions\n· Theme System` to:
  `The ghost-node pattern: declare only what changes.\nPrevious scene nodes carry forward at reduced opacity.\nOne scene system, infinite depth.`
- Remove dot-list format, use plain prose
- Add a brief headline before the body: `Click a group.\nZoom to the detail.\nGhost the rest.` in `clamp(18px, 2.5vw, 22px)` weight 600

---

### NEW SCENE: Chart Teaser (between Act 6 and Act 7)

**Role in narrative:** @brewsite/chart is "coming soon." The website must address this — visitors have seen `@brewsite/chart` in the ecosystem card. This scene shows what it will look like and why it's different from every other chart library.

**Placement:** After `scene_03_arch_detail.tsx`, before `scene_01_foundation.tsx`

**3D content (to be built — no existing scene):** This requires creating a new scene file. The scene should show a conceptual preview of a 3D bar chart using the neonCyberTheme visual language. Since the charts package is not yet shipped, the actual chart content is placeholder. Two options:

**Option A (recommended): Use a DiagramCanvas to approximate a bar chart**
Use `@brewsite/diagram` with tall narrow rectangles as "bars" arranged manually, representing quarterly revenue data. Add a `DiagramCanvas` with `darkGlassTheme` and manually position 4-6 "bar" nodes at different heights. Label them with quarter values. This creates a convincing visual approximation using existing packages.

**Option B: Static image panel**
Use `@brewsite/diagram`'s `<ImagePanel>` element with a pre-rendered screenshot of a bar chart. Simpler but less impressive.

**Recommended 3D content:** Option A — DiagramCanvas approximation. The bars would be `<DiagramNode>` elements with varying `size={[1, barHeight]}` and `color` based on value, arranged horizontally with a `ManualLayout`. This is technically using the wrong tool for charts, but visually it communicates the concept correctly.

**Proposed overlay copy:**

```
Eyebrow:       @brewsite/chart  ↗ Coming Soon

Headline:      Data stories
               in three dimensions.

Body:          Not a canvas texture on a plane.
               Native Three.js geometry — real bars, real tubes, real spheres.
               D3 math. Three.js materials. The same visual language
               as every other BrewSite package.
```

**Tag:**
```
Bar · Line · Area · Pie · Scatter · Heatmap
```

**Why this matters:** The ecosystem card mentions `@brewsite/chart` but gives no visual context. Developers evaluating BrewSite need to know: (1) charts are coming, (2) they'll be native 3D geometry not canvas textures, (3) they follow the same declarative model. This scene sets that expectation and creates anticipation. It also differentiates from `@nivo/core` and `echarts` which are canvas-based.

**Implementation notes:**
- Create new file `apps/website/src/scenes/act6_chart/scene_01_chart_teaser.tsx`
- Use DiagramCanvas bar approximation or ImagePanel placeholder
- Add to `websiteFlowScenes` between arch_detail and foundation
- Nav label: `Charts (Soon)`
- No `ProgressManager` autoAdvance — let this scene be a dwell

---

### Scene 9: `act7/scene_01_foundation.tsx`

**Role in narrative:** Transition scene before the full-stack combined demo. This is the "deep breath" moment — one clear statement that everything seen so far (models, diagrams, charts) is driven by one engine.

**Current issues:** Not wired. 3D content is an empty room (just floor mirror and lights). No geometry.

**3D content:** The current scene has no 3D objects. Two options:
1. Add a centered `<Model>` element (a single bot character standing in the reflective room)
2. Keep empty but add dramatically lit empty-room aesthetic, suggesting the canvas before a scene is built

**Recommended:** Option 1 — add a single standing bot/worker model. This serves as visual anticipation for the combined scene that follows.

**Proposed overlay copy:**

```
Eyebrow:       Everything you've seen

Headline:      One engine.
               Infinite forms.

Body:          Models and diagrams and data and React
               all compiled from the same declarative JSX.
               Web apps. Pitches. Decks. Product tours.
               If you can scroll it, BrewSite can animate it.
```

**Why this matters:** This is the emotional peak before the reveal. "If you can scroll it, BrewSite can animate it." is the big claim that the combined scene then proves.

**Implementation notes:**
- Wire this scene into websiteFlowScenes.tsx (add after chart teaser or scene_03_arch_detail)
- Add a `<Model>` element for the worker character (from `siteResources.ts` — use whichever character asset is available)
- Camera: keep `(isMobile ? [0, 10, 40] : [0, 12, 55])` and `target={[0, 4, 0]}`
- Change eyebrow from `BrewSite` to `Everything you've seen`
- Change headline from `One engine.\nInfinite forms.` — this is good, keep it
- Add body text below the headline using `clamp(15px, 1.8vw, 18px)`, `rgba(240,246,252,0.65)` color

---

### Scene 10: `act7/scene_02_combined.tsx`

**Role in narrative:** The proof. A 3D scene with a character model AND a diagram AND HUD overlay all running together. This is what a real BrewSite project looks like.

**Current issues:** Not wired. `ModelRouter` is imported but **no `<Model>` DSL element is placed in the scene**. There are no characters in the 3D content.

**3D content fix required:** Add a `<Model>` element to the scene — a worker/bot character positioned to the left of the diagram, in front of the floor mirror. The character should be positioned at approximately `position={[-12, 0, 5]}` with an idle animation.

**Proposed overlay copy:**

```
Eyebrow:       Models + Diagrams + HUD + React

Headline:      Web apps. Decks.
               Pitches. Marketing sites.

Body:          One EngineProvider. Everything compiled.
               Scroll it, auto-advance it, embed it.
               TypeScript end to end.
```

**Why this matters:** The combined scene is the visual proof of the "one engine" claim. Visitors have seen models, diagrams, and HUD separately. Now they see them together, in the same compiled scene, with the same floor mirror, same lighting rig, same scroll engine.

**Implementation notes:**
- Wire this scene into websiteFlowScenes.tsx (after foundation)
- Add `<Model>` DSL element using the worker asset: `<Model id="worker-combined" type="worker" position={[-12, 0, 5]} animation={{ clipName: 'idle' }} />`
- The ModelRouter import is already present — the worker widget just needs to be registered in widgetSetup.ts for this scene context
- Change body from absent to the three lines above
- Keep eyebrow `Models + Diagrams + HUD + React`
- Keep headline `Web apps. Decks.\nPitches. Marketing sites.`

---

### Scene 11: `act8/scene_01_github.tsx`

**Role in narrative:** The payoff. You've seen what BrewSite does. Here's where you start.

**Current issues:** Not wired. Content is excellent — only requires being added to the flow.

**Proposed copy (minimal changes — this is already good):**

```
Terminal:      $ pnpm add @brewsite/core @brewsite/model @brewsite/diagram
               added 3 packages in 1.2s

Headline:      Open Source. Production Ready.

Body:          Built for TypeScript. Powered by React.
               Install the engine, then add only what your story needs.

CTA:           ★ Star on GitHub →
```

**One change:** The body currently reads `"Install the engine, then add only what your story needs."` — this is good but can be one sentence punchier:

**Proposed body:**
```
Built for TypeScript. Powered by React.
The engine is @brewsite/core. Everything else is optional.
```

**Why this matters:** The install command needs to match the "install only what you need" message from the ecosystem scene. Three packages shown here (`core`, `model`, `diagram`) with the implication that `@brewsite/chart` will be `pnpm add @brewsite/chart` when it ships.

**Implementation notes:**
- Wire this scene into websiteFlowScenes.tsx (last scene)
- Update body: change `"Install the engine, then add only what your story needs."` to `"The engine is @brewsite/core. Everything else is optional."`
- Nav label: `Get Started`

---

## Part 4: websiteFlowScenes Rewrite

### Current (broken) order:
```typescript
[hero, core_intro, core_baked, simple_diagram, arch_overview, arch_detail, model, meeting]
```

### Proposed correct order:
```typescript
[
  hero,              // scene_00_hero (locked)
  core_intro,        // scene_01_core_intro — @brewsite/core, "Scenes as React"
  core_baked,        // scene_02_core_baked — Pre-baked. O(1) playback.
  ecosystem,         // scene_03_ecosystem — One engine. Four packages.
  model_wide,        // scene_01_model — @brewsite/model, GLTF intro
  meeting,           // scene_02_meeting — 30 characters. 50 lines of JSX.
  simple_diagram,    // scene_01_simple_diagram — Any graph. Five lines of JSX.
  arch_overview,     // scene_02_arch_overview — Production architecture
  arch_detail,       // scene_03_arch_detail — Drill down. Stay in the scene.
  chart_teaser,      // NEW — @brewsite/chart coming soon
  foundation,        // scene_01_foundation — One engine. Infinite forms.
  combined,          // scene_02_combined — Everything together
  github,            // scene_01_github — Install command + CTA
]
```

### Nav targets (updated labels):
```typescript
{ num: '00', label: 'BrewSite',        sceneId: 'website-hero-00' },
{ num: '01', label: 'The Engine',      sceneId: 'website-presentation-01' },
{ num: '02', label: 'How It Works',    sceneId: 'website-presentation-02' },
{ num: '03', label: 'Ecosystem',       sceneId: 'website-ecosystem-01' },
{ num: '04', label: 'Models',          sceneId: 'website-model-01' },
{ num: '05', label: 'At Scale',        sceneId: 'website-meeting-01' },
{ num: '06', label: 'Diagrams',        sceneId: 'website-diagram-simple' },
{ num: '07', label: 'Architecture',    sceneId: 'website-arch-overview' },
{ num: '08', label: 'Drill-Down',      sceneId: 'website-arch-detail' },
{ num: '09', label: 'Charts (Soon)',   sceneId: 'website-chart-teaser' },
{ num: '10', label: 'Full Stack',      sceneId: 'website-full-01' },
{ num: '11', label: 'Combined',        sceneId: 'website-full-02' },
{ num: '12', label: 'Get Started',     sceneId: 'website-github-01' },
```

---

## Part 5: Chart Library Showcase

### The Problem
`@brewsite/chart` appears as a "coming soon" badge in the ecosystem scene but has no dedicated visual showcase. This is a missed opportunity — visitors have no idea what "3D charts" actually looks like, and many will assume it means a flat chart inside a 3D panel (which is how ECharts/Chart.js would integrate).

### The Architecture Message to Communicate
The `@brewsite/chart` package design note is explicit: charts are **native Three.js geometry**, not canvas textures on a plane. This is the key differentiator:
- Bar charts = real `BoxGeometry` objects that cast shadows and catch environment light
- Line charts = `TubeGeometry` (a glowing 3D tube traces the data path)
- Scatter plots = `InstancedMesh` spheres in world space
- Heatmaps = raised tile grids where height encodes a second data dimension

This is genuinely different from every other React charting library, and the website must show it.

### The Chart Teaser Scene Content

**Data story to tell:** Quarterly revenue growth across four business regions. Simple, recognizable, business-relevant. Four bars (Q1–Q4), 2 series (APAC and Americas).

**Why this data:** Every developer can immediately understand "quarterly revenue chart." It grounds an abstract technical capability in a concrete, relatable business context.

**Visual concept (using DiagramCanvas approximation):**

Place 8 `<DiagramNode>` elements as "bars":
- APAC series: 4 nodes in cyan (`#00f5ff` matching neonCyberTheme) at positions `[-3, 0, 0]`, `[-1, 0, 0]`, `[1, 0, 0]`, `[3, 0, 0]`
- Americas series: 4 nodes in amber (`#ffaa00`) positioned at same X, slightly offset in Z
- Node heights vary: Q1 `size={[0.8, 1.8]}`, Q2 `size={[0.8, 2.6]}`, Q3 `size={[0.8, 3.4]}`, Q4 `size={[0.8, 4.2]}`
- Pivot to bottom of each bar
- Labels at top of each bar with quarter and value

**Axis labels:** Use thin horizontal `<DiagramEdge>` elements at `y=0` for the floor line.

**Proposed overlay copy:**

```
Eyebrow:       @brewsite/chart  ↗ Coming Soon

Headline:      Data in 3D.
               Not on a canvas.

Body:          Real bars. Real tubes. Real spheres.
               D3 computes the math. Three.js renders the geometry.
               Charts that cast shadows, catch light, and orbit with your scene.

Tags:          Bar · Line · Area · Pie · Scatter · Heatmap
```

**Why "Not on a canvas" matters:** This is the differentiating claim. Every other React chart library renders to an HTML canvas element that is then composited over the 3D scene as a flat texture. `@brewsite/chart` renders geometry directly in the Three.js scene. This is technically superior for immersive 3D contexts. The copy must say this explicitly.

**What data to show in the final `@brewsite/chart` scene (when shipped):**

Use a bar chart with quarterly revenue data:
```typescript
const data = [
  { quarter: 'Q1', apac: 1_200_000, americas: 2_100_000 },
  { quarter: 'Q2', apac: 1_850_000, americas: 2_450_000 },
  { quarter: 'Q3', apac: 2_300_000, americas: 2_800_000 },
  { quarter: 'Q4', apac: 3_100_000, americas: 3_200_000 },
];
```

The bars should be grouped (APAC and Americas side-by-side for each quarter), colored with theme colors, and animated in from y=0 on scene entry. The scene should have a floor mirror, `darkGlassTheme` for the chart, and the same ambient + directional lighting as the architecture scenes.

---

## Part 6: Tone Guidance

### The BrewSite Voice

**Who is talking:** A senior TypeScript engineer who has shipped production Three.js code and has opinions about developer experience. This person doesn't oversell. They make specific technical claims, then show evidence.

**Core tone attributes:**
- **Precise, not vague.** "O(1) sampling" not "blazing fast." "50 lines of JSX" not "minimal code." Numbers when you have them.
- **Technical without being inaccessible.** React developers understand `JSX`, `declarative`, `compiler`, `TypeScript-first`. Use these words. Don't use Three.js jargon (`BufferGeometry`, `AnimationMixer`) in marketing copy.
- **Show, don't describe.** When a scene demonstrates a capability, the copy should name what you're seeing, not describe it abstractly. "You're looking at 16 nodes, 4 tiers, 8 edges" not "powerful architectural visualization."
- **Short.** The best headline on the site is "30 characters. 50 lines of JSX." Four words. One number. Two numbers. The end.
- **Consequential.** Every sentence should make a claim that matters to the decision of whether to adopt the toolkit. Strip sentences that could belong on any developer tool's marketing site.

### Words to Use
- `Declare` / `declarative` — the authoring model is the key value
- `Compile` / `compiled` / `compiler` — the mechanism is a differentiator
- `Scene` — the BrewSite concept, not "animation" or "slide"
- `Pre-baked` — explains the O(1) mechanism without math
- `GLTF` — developers know what this is; use the real word
- `PBR` / `physically based` — developers who care about visual quality know this
- `Scroll-driven` — specific to the interaction model
- `Native Three.js` — for chart copy, distinguishing from canvas approach

### Words to Avoid
- `Presentation` — incorrectly anchors BrewSite as a slide tool
- `Stakeholder` — corporate speak, wrong audience register
- `Powerful` — meaningless filler
- `Blazing fast` / `lightning fast` — meaningless without numbers
- `Seamless` — always meaningless
- `Next-generation` — cringe
- `Leverage` — business speak
- `Paradigm shift` — overused
- `No Figma required` — negative framing; say what you CAN do, not what you eliminate
- `Presentation-ready` — circular; "ready for what?" Also triggers the Act 1 confusion

### Sentence Structure Patterns That Work
1. **Imperative + consequence:** "Declare states. The compiler handles the rest."
2. **Number claim:** "30 characters. 50 lines of JSX."
3. **Feature + mechanism:** "Pre-baked. O(1) playback." (implies the WHY in three words)
4. **Contrast:** "Not on a canvas. Native Three.js geometry."
5. **Scope + count:** "16 nodes · 4 tiers · 8 edges"

### Eyebrow Conventions
Eyebrows should be one of:
- The package name: `@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, `@brewsite/chart`
- A capability label in `TITLE CASE` monospace: `Procedural Composition`, `Pre-baked. O(1) playback.`
- A status indicator: `Coming Soon`

Do NOT use eyebrows as category labels that describe the content abstractly (`Presentation Use Case`, `Production Architecture`) — these read as internal taxonomy, not marketing copy.

---

## Part 7: Summary of Required Changes

### Priority 1 — Critical (site is broken without these)

| # | Change | File |
|---|--------|------|
| 1 | Wire `scene03Ecosystem` into `websiteFlowScenes` | `websiteFlow.tsx` |
| 2 | Wire `scene01Foundation` into `websiteFlowScenes` | `websiteFlow.tsx` |
| 3 | Wire `scene02Combined` into `websiteFlowScenes` | `websiteFlow.tsx` |
| 4 | Wire `scene01Github` into `websiteFlowScenes` | `websiteFlow.tsx` |
| 5 | Reorder scenes in `websiteFlowScenes` per proposed order above | `websiteFlow.tsx` |
| 6 | Add `<Model>` element to `scene_02_combined.tsx` (currently no model) | `scene_02_combined.tsx` |

### Priority 2 — High (messaging is wrong or weak)

| # | Change | File |
|---|--------|------|
| 7 | Rewrite scene_01_core_intro eyebrow/headline/body (remove "Presentation Use Case") | `scene_01_core_intro.tsx` |
| 8 | Rewrite scene_02_core_baked eyebrow/headline/body/tags (remove "Slide Two") | `scene_02_core_baked.tsx` |
| 9 | Rewrite scene_02_arch_overview bottom headline (remove "Presentation-ready") | `scene_02_arch_overview.tsx` |
| 10 | Rewrite scene_03_arch_detail body copy (remove jargon list) | `scene_03_arch_detail.tsx` |
| 11 | Rewrite scene_01_foundation eyebrow + add body + add 3D model | `scene_01_foundation.tsx` |
| 12 | Update nav labels in `websiteNavTargets` | `websiteFlow.tsx` |

### Priority 3 — Medium (improvements to good-but-improvable scenes)

| # | Change | File |
|---|--------|------|
| 13 | Create chart teaser scene (`scene_01_chart_teaser.tsx`) | New file |
| 14 | Rewrite scene_01_model overlay (consolidate to single-column) | `scene_01_model.tsx` |
| 15 | Rewrite scene_01_simple_diagram headline/body | `scene_01_simple_diagram.tsx` |
| 16 | Update `@brewsite/chart` card body in ecosystem scene | `scene_03_ecosystem.tsx` |
| 17 | Update scene_02_meeting body last sentence | `scene_02_meeting.tsx` |
| 18 | Update scene_01_github body last sentence | `scene_01_github.tsx` |

### Priority 4 — Low (polish)

| # | Change | File |
|---|--------|------|
| 19 | Add headline to scene_03_arch_detail | `scene_03_arch_detail.tsx` |
| 20 | Add body copy to scene_02_arch_overview | `scene_02_arch_overview.tsx` |

---

## Appendix: Complete Copy Reference Table

All copy is specified here in one table for easy reference during implementation.

| Scene | Eyebrow | Headline | Body | Tags |
|-------|---------|----------|------|------|
| scene_01_core_intro | `@brewsite/core` | `Scenes as React.\nRendered like film.` | `Describe each state in JSX.\nThe compiler builds all the transitions.\nNo animation loops. No frame math. No Three.js required.` | — |
| scene_02_core_baked | `Pre-baked. O(1) playback.` | `Declare states.\nThe compiler handles the rest.` | `Author time: the compiler bakes every transition to a flat array.\nPlayback time: one array lookup per frame.\nScroll position → tick index → Three.js state. That's it.` | `Declarative · Pre-Baked · O(1) Sampling · SSR-Safe · TypeScript-First · Scroll-Driven` |
| scene_03_ecosystem | `The Ecosystem` | `One engine.\nFour packages.` | (card grid — see above) | — |
| scene_01_model | `@brewsite/model` | `Every character\nis a GLTF.` | `Register the asset. Place the model.\nAssign any animation clip in the DSL.\nPBR materials, shadows, and floor reflections\ncome from the renderer — not your code.` | — |
| scene_02_meeting | `Procedural Composition` | `30 characters.\n50 lines of JSX.` | `Placement. Collision detection. Animation assignment.\nAll computed at author time.\nRuntime is pure playback — not a single conditional.` | — |
| scene_01_simple_diagram | `@brewsite/diagram` | `Any graph.\nFive lines of JSX.` | `<DiagramNode>, <DiagramEdge>, a theme.\nAutomatic layout. Routed edges. 20+ icon namespaces.\nThe same declarative model as everything else.` | — |
| scene_02_arch_overview | `16 nodes · 4 tiers · 8 edges` (stat counter) | `Your production\narchitecture,\nin a scene.` | `Groups, swimlanes, and nested tiers.\nEvery node positioned, every edge routed —\nautomatically, at compile time.` | — |
| scene_03_arch_detail | `Drill down. Stay in the scene.` (eyebrow stays) | `Click a group.\nZoom to the detail.\nGhost the rest.` | `The ghost-node pattern: declare only what changes.\nPrevious scene nodes carry forward at reduced opacity.\nOne scene system, infinite depth.` | — |
| scene_01_chart_teaser (NEW) | `@brewsite/chart  ↗ Coming Soon` | `Data in 3D.\nNot on a canvas.` | `Real bars. Real tubes. Real spheres.\nD3 computes the math. Three.js renders the geometry.\nCharts that cast shadows, catch light, and orbit with your scene.` | `Bar · Line · Area · Pie · Scatter · Heatmap` |
| scene_01_foundation | `Everything you've seen` | `One engine.\nInfinite forms.` | `Models and diagrams and data and React\nall compiled from the same declarative JSX.\nIf you can scroll it, BrewSite can animate it.` | — |
| scene_02_combined | `Models + Diagrams + HUD + React` | `Web apps. Decks.\nPitches. Marketing sites.` | `One EngineProvider. Everything compiled.\nScroll it, auto-advance it, embed it.\nTypeScript end to end.` | — |
| scene_01_github | `Open Source. Production Ready.` (headline) | terminal card | `Built for TypeScript. Powered by React.\nThe engine is @brewsite/core. Everything else is optional.` | — |
