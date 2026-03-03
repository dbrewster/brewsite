---
title: "BrewSite Brand Strategy Proposal — Voice, Messaging, and Differentiators"
doc_type: note
owner: Toolkit Product
status: draft
updated: 2026-03-03
---

# BrewSite Brand Strategy Proposal

## Preface: The Constraint That Shapes Everything

Before writing a single word of brand strategy, start with the hero scene. Read it carefully:

A dark room. A neon sign flickers to life. Then — only after it's fully lit — a single sentence appears:

> "The React toolkit for **3D storytelling.**"

Below it, barely visible: "Scenes as React. Rendered like film."

Then four package badges. Then a scroll indicator.

That's it. No bullet points. No feature lists. No "simple," "powerful," or "easy to use." The room does the talking first, and when words appear, they're spare, declarative, and precise.

This is the brand. Everything in this document extends from it.

---

## 1. Who BrewSite Is For

### Persona 1: The Frontend Engineer Who's Outgrown CSS Animations

**Name/archetype:** Senior frontend developer, 4–8 years experience, TypeScript fluent.

**Company context:** Mid-size SaaS or a fast-growing startup. They own or heavily influence the marketing site and product demo pages.

**Current tools:** Framer for landing pages (but they can't get the exact effect they want), CSS animations for small interactions, maybe some Canvas work they maintain nervously, possibly a Spline embed they can't actually customize.

**What they want:** Something that looks like the Apple product pages — cinematic, scroll-driven, 3D — but built in actual React, not inside a Figma-adjacent tool that exports mystery code.

**What frustrates them today:**
- "Spline is beautiful but I can't compose it with real data or real React state."
- "Three.js takes three weeks to get one decent animated scene. I've done it once. Never again alone."
- "Rive is amazing for 2D lottie-style stuff but as soon as I want depth or camera moves I'm stuck."
- "Framer is someone else's design language. I want ours."
- "I've been Frankensteining gsap + canvas + some Three.js utility library and it falls apart every time the design changes."

**What they need BrewSite to give them:**
- A way to describe 3D scenes in the same file as the rest of the product, in TypeScript, with real React component composition.
- Confidence that it will work on mobile. (They've been burned.)
- Enough control to implement exactly what the designer or PM wants — not what a tool's presets allow.

**Where they are in the journey:** Googling. Looking at GitHub stars. Checking the bundle size. They will clone the examples repo before reading the README.

---

### Persona 2: The Developer Advocate or Engineering Lead at a Dev-Tools Company

**Name/archetype:** Developer advocate, DevRel engineer, or engineering lead responsible for the technical marketing property. Writes code. Speaks at conferences. Cares about how the product _presents_.

**Company context:** Infrastructure company, cloud platform, developer tool. Their audiences are technical. Their marketing has to prove it — not just claim it.

**Current tools:** Static Figma exports and Lottie files from a design agency. Or their previous company's homegrown Three.js codebase, maintained by exactly one person who left six months ago.

**What they want:** Architecture diagrams that actually look like architecture — not PowerPoint boxes. A way to show a microservices topology, an infrastructure overview, or a data pipeline that moves through multiple slides without losing spatial context.

**What frustrates them today:**
- "Our architecture diagrams are stuck in Notion. They look terrible. The design team won't touch them."
- "We have a Spline animation of our product but it has nothing to do with our actual product. It's abstract swooshes."
- "Our engineers can't maintain the marketing site animations. It requires a specialist."
- "Every 3D animation tool assumes our audience cares about whether things bounce. They don't. They care about whether the topology is right."

**What they need BrewSite to give them:**
- Real architecture diagram rendering. AWS icons, routing, groups. Real data relationships, not decorative shapes.
- The ability to hand DSL files to a frontend engineer and have them maintain it like any other React code.
- Mobile-first performance. Their audience is on laptops at conferences, iPhones on the train.

---

### Persona 3: The Technical PM or Growth Engineer Running Campaigns

**Name/archetype:** Technical product manager or growth engineer at a B2B SaaS. Comfortable reading code, maybe can write React, owns the conversion rate on the marketing site.

**Current tools:** Webflow with custom JavaScript, a design agency for animations, Lottie for smaller interactions.

**What they want:** A presentation-quality product demo experience embedded in the marketing site — the kind that walks visitors through the product story without making them install anything or watch a recorded video.

**What frustrates them today:**
- "We pay $40K for an animated product video that's out of date in six months."
- "Our Webflow site has a hardcoded Lottie of our product that looks nothing like the actual product."
- "We can't A/B test the 3D sections. Everything is baked into a video file."
- "We want to show our data visualization capabilities with a real chart, not a screenshot of a chart."

**What they need BrewSite to give them:**
- Data-backed 3D charts that use real product data. Not screenshots.
- Product demo scenes that can be updated in code when the product changes.
- Composable scenes — a PM can change the copy, a designer can tweak the camera, a dev can deploy it.

---

### Who BrewSite is NOT for (equally important)

- Designers who don't write code. There is no visual editor. This is a code-first toolkit.
- Teams that want a one-click 3D landing page template. BrewSite is a toolkit, not a product.
- People whose entire 3D requirement is one animated logo. The toolkit has a fixed integration cost; it pays off at scene-level complexity, not badge-level complexity.
- Anyone who needs physics, audio, or VR. Explicitly out of scope.

---

## 2. Core Value Proposition

> **BrewSite is the React toolkit for 3D storytelling — declarative scenes that compile to film-quality playback, without writing a single frame of animation math.**

One sharper sentence for tagline use:

> **Write the scenes. The compiler writes the film.**

Or the currently shipped version — which is correct and should stay:

> **Scenes as React. Rendered like film.**

The technical truth behind the value proposition: BrewSite's compiler pre-bakes every frame of every transition into a flat array. At runtime, sampling is O(1) — a multiplication and an array lookup. There is no per-frame interpolation, no curve evaluation, no conditional branching. The animation runs like a film projector: it just reads the next frame. This is the architectural insight that makes everything else possible. It's why you can have 30 animated characters on a phone. It's why scene transitions are visually smooth even under CPU pressure.

The customer-facing translation: "You describe what each scene looks like. BrewSite figures out how to get between them. You never write a lerp."

---

## 3. Key Differentiators

### Differentiator 1: Declarative snapshots, not keyframes

**Technical reality:** Scene files describe state at rest — what exists, where it is, what it looks like. No animation math. No frame callbacks. No timeline scrubbing. The compiler generates all transitions automatically by calling registered widget transition handlers per scene boundary.

**Customer-facing language:** "You describe the before and after. BrewSite animates the middle. Stop writing lerps."

**Why this matters vs. alternatives:**
- Three.js DIY: you write every lerp, every easing curve, every fade.
- GSAP: you define keyframes and timelines, which means you own the animation math.
- Theatre.js: you use an external timeline editor separate from your code.
- BrewSite: you write JSX snapshots. The toolkit generates animation automatically.

**The headline this gives us:** "No animation loops. No frame math. Just describe the scene."

---

### Differentiator 2: Pre-compiled O(1) playback

**Technical reality:** The compiler runs once and produces a flat `SceneTrack` array. Each element is a fully resolved frame. At playback, sampling is `array[Math.floor(progress * length)]` — a constant-time operation regardless of scene count or transition complexity.

**Customer-facing language:** "Pre-baked, not real-time. Your animation runs like a film projector — it just reads the next frame. No CPU spikes. No dropped frames on mobile."

**Why this matters vs. alternatives:**
- Real-time animation interpolation (GSAP, custom Three.js, React Spring) does curve evaluation every frame. Under load, frames drop.
- BrewSite's approach decouples animation quality from runtime CPU. The frames are already computed.

**The headline this gives us:** "30 animated characters on a 2024 phone. Because the math ran at compile time."

---

### Differentiator 3: 3D diagrams with real icons, real layout, real routing

**Technical reality:** `@brewsite/diagram` provides a complete 3D diagram element with: 9+ cloud provider icon namespaces (100+ icons), 4 auto-layout algorithms (grid, hierarchical, manual, group-cascade), automatic edge routing with 4 algorithms, 4 visual themes, hover/click interaction, and cross-diagram pipe connectors — all as real Three.js geometry with PBR materials.

**Customer-facing language:** "Architecture diagrams that actually look like architecture. AWS Lambda. GCP Cloud Run. Azure Functions. Real icons. Real edge routing. No Figma required."

**Why this matters vs. alternatives:**
- Spline: free-form 3D design, not a diagram system. No icons, no edge routing, no layout engine.
- Mermaid.js / D2: 2D SVG output. Not 3D. No PBR materials. No camera.
- Custom Three.js: you'd build the layout engine, edge router, icon system, and theme system from scratch.

**The headline this gives us:** "From whiteboard to 3D. No Figma. No designer."

---

### Differentiator 4: 3D charts as real geometry, not textures

**Technical reality (coming in @brewsite/chart):** Charts are native Three.js objects powered by D3 math — bar charts are real `BoxGeometry`, line charts are `TubeGeometry`, pie slices are `ExtrudeGeometry`. A camera can orbit around a bar chart and see the bars from the side. Bars cast shadows. Pie slices catch environment light.

**Customer-facing language:** "Your revenue chart doesn't live on a flat texture. It lives in the scene. Orbit around it. Let it catch the light. Let it cast a shadow."

**Why this matters vs. alternatives:**
- Every other charting library (ECharts, Recharts, Nivo) renders to a 2D canvas or SVG and optionally textures it onto a Three.js plane. You get a flat picture on a flat rectangle. It's not 3D — it's 3D-shaped packaging around a 2D image.
- BrewSite charts are real 3D objects. The camera, lighting, and materials apply to the chart data itself.

**The headline this gives us:** "The bars cast shadows. Because they're real."

---

### Differentiator 5: React-native authoring — not a DSL you learn, it's the component model you already know

**Technical reality:** Scenes are JSX. Transitions are typed props. Widgets are classes that implement TypeScript interfaces. The entire authoring surface is the React component tree.

**Customer-facing language:** "If you can write a React component, you can write a scene. The compiler handles the rest."

**Why this matters vs. alternatives:**
- Spline: proprietary visual editor, non-code.
- Lottie: animation files exported from After Effects — not code.
- Rive: state machines defined in a GUI, not in code.
- GSAP/Theatre.js: code, but not React-native. You write timeline code that lives outside your component model.
- BrewSite: the scene IS the component. The `<Scene>` is a React element. The `<Camera>` is a React element. TypeScript catches your typos.

**The headline this gives us:** "Your scenes are React components. That's not a metaphor — they're literally JSX."

---

## 4. Messaging Hierarchy

### Primary message (the claim)
> **BrewSite is the React toolkit for 3D storytelling.**

This is the positioning claim. It appears in the hero. It goes in the meta description. It's what a developer should be able to repeat after seeing the hero for 30 seconds.

Every word is load-bearing:
- **React** — not "JSX," not "web," not "JavaScript." React is the paradigm — component model, declarative, TypeScript-native. This signals who the audience is.
- **toolkit** — modular packages. Not a single library, not a framework, not a platform.
- **3D** — distinguishes from CSS animation toolkits, SVG tools, Lottie, Rive.
- **storytelling** — the use case, not the mechanism. Not "3D animation" (sounds like game engine), not "3D UI" (sounds like dashboard). Storytelling is marketing scenes, product demos, presentations, pitches.

### Secondary message (the how)
> **Scenes as React. Rendered like film.**

This answers "how?" It explains the authoring model and the output quality in five words. "Scenes as React" = the authoring paradigm. "Rendered like film" = the pre-baked compilation philosophy.

This line earns its place because it immediately differentiates from animation libraries (which render in real-time) and from visual editors (which don't use React).

### Tertiary message (the proof)
> **One engine. Four packages.**

This answers "what specifically?" It introduces the modular architecture — the fact that you install only what you need: `@brewsite/core` for the engine, `@brewsite/model` for GLTF characters, `@brewsite/diagram` for architecture diagrams, `@brewsite/chart` for data visualization.

The ecosystem message signals that this is a mature toolkit with thought-out package boundaries, not a monolithic blob.

### Supporting messages (one per capability)
In order of introduction through the site:

1. **The engine:** "Declare states. Let the compiler handle transitions. No animation loops. No frame math."
2. **Models:** "Drop a GLTF. Animate the world." / "Metalness, roughness, normals — the renderer handles it. You handle the story."
3. **Scale:** "30 characters. 50 lines of JSX." (Procedural composition — random placement, collision detection, animation assignment at author time.)
4. **Diagrams:** "From whiteboard to 3D." / "No Figma required."
5. **Architecture:** "Drill down. Stay in the scene."
6. **Full stack:** "One engine. Infinite forms." / "Web apps. Decks. Pitches. Marketing sites."
7. **CTA:** "Built for TypeScript. Powered by React. Install the engine, then add only what your story needs."

### Hierarchy rules
- Never lead with features. Lead with the scene.
- Never claim "easy" — show the code, show the result, let the developer decide.
- Never claim "powerful" — say what specifically it does. "30 characters on a phone" is specific. "Powerful animation" is nothing.
- The architecture innovation (pre-baked O(1) playback) is a supporting proof point, not the primary message. Engineers will find it compelling; it belongs one level below the top-line claim.

---

## 5. Brand Voice

### Voice Attributes

**1. Declarative.** Like the DSL itself. Short sentences. Subject-verb-object. No hedging, no qualifiers, no "can be used to." "Scenes are React components. The compiler writes the transitions. You write the story."

**2. Cinematically precise.** Every word earns its place. "Rendered like film" is four words that do specific work — they claim pre-baked deliberate output, evoke craft, and distinguish from real-time rendering. Sloppy synonyms ("built for the web," "looks amazing," "smooth animations") are cut.

**3. Technically confident without being academic.** Reference the real architecture when it matters. "Pre-baked at compile time" is correct and says something. "O(1) sampling" is appropriate on the engine scene, not in the hero. Know when to elevate the technical vocabulary and when to stay at the outcome level.

**4. Respects developer intelligence.** No condescension. No exclamation points on feature announcements. No "super easy setup in just 3 steps!" Developers smell marketing language and it makes them distrust the product.

**5. Slight cool factor — not hype.** The neon sign sets a tone. The product has an aesthetic — dark, industrial, electric cyan. The copy should feel like it came from the same place: not flashy, not ironic, but cool in the way that a well-made piece of engineering is cool.

---

### 5 Headlines IN VOICE

These feel at home in the product:

1. **"No animation loops. No frame math. Just describe the scene."**
   — Declarative, specific about what it removes, respects developer frustration.

2. **"Your architecture diagram deserves a camera."**
   — Single sentence, specific claim, slightly provocative, uses "deserves" (earned quality, not easy-button marketing).

3. **"30 characters. 50 lines of JSX."**
   — Concrete proof. The juxtaposition does the work. Trust the developer to understand why that ratio is impressive.

4. **"The bars cast shadows. Because they're real."**
   — Short, technical, a little dramatic. The second sentence lands because it's not explaining — it's stating.

5. **"Scroll the page. Advance the scene. There's no difference."**
   — Explains the interaction model by demonstrating it in the sentence structure.

---

### 5 Headlines OUT OF VOICE

These feel wrong. They belong in a different product's marketing.

1. **"Create stunning 3D animations in minutes!"**
   — "Stunning," "create," and the exclamation point are all wrong. Claims ease and results without specificity. Sounds like Canva.

2. **"The most powerful 3D toolkit for the modern web."**
   — "Most powerful" is unmeasurable and unearned. "Modern web" is empty. This is what a product team writes when they have nothing specific to say.

3. **"Bring your marketing pages to life with immersive 3D experiences."**
   — "Bring to life" is a cliché. "Immersive 3D experiences" is jargon. This belongs in a Webflow template description.

4. **"Easy to learn, powerful to use."**
   — The most exhausted line in developer marketing. BrewSite has a learning curve. Claiming it doesn't is a lie. Developers know it when they see it.

5. **"Transform your website with next-level animations!"**
   — "Transform," "next-level," and the exclamation point are three separate crimes. Every single word is a cliché or a lie.

---

### Dos and Don'ts

**DO:**
- Write short sentences. Subject-verb-object.
- Name the specific thing: "AWS Lambda icon," not "cloud provider icon."
- Use the actual technical terms when talking to developers: compiler, pre-baked, declarative, PBR materials, Three.js, GLTF.
- Show a number: "30 characters," "50 lines," "O(1) sampling."
- Make a claim and prove it in the next sentence.
- Let the visuals do work. Copy doesn't need to describe what the scene already shows.
- Use periods, not exclamation points.
- Trust the reader to know why something is impressive.

**DON'T:**
- Say "easy," "simple," "seamless," "intuitive," or "effortless." Show the DSL — let developers decide.
- Say "stunning," "beautiful," "amazing," "gorgeous."
- Say "powerful" without specifying what it can do that alternatives can't.
- Use passive voice: "animations can be created" → "create animations."
- Use filler openers: "With BrewSite, you can..." → just start with the action.
- Describe features as benefits before demonstrating them.
- Use more than one exclamation point on the entire website. (Currently the count is zero. Keep it.)
- Say "next-level," "modern," "next-gen," "cutting-edge," "transform," "revolutionize."
- Explain the hero. The room does the explaining.

---

## 6. The Narrative Arc — Scene by Scene

The website is a film with acts. Each act has a specific emotional job. Here's what should happen inside the visitor's head at each stage.

### Act 0: The Neon Sign (Hero)

**What the visitor experiences:** A dark room. A neon sign powers on. Then a headline. Then package names.

**Emotional register:** Intrigue → recognition. This is not a standard marketing website. It doesn't open with a value proposition and a hero image. It opens with *atmosphere*. The viewer doesn't know what this is yet, but it feels like something.

**The realization that should click:** "This site is made with the thing it's selling. The neon sign in the dark room IS the product demonstration." (This is true — the hero is a real Three.js scene rendered by `@brewsite/core`.)

**Transition emotion:** Curiosity. They scroll.

---

### Act 1: The Engine

**What the visitor experiences:** A text-driven HUD scene. No 3D objects yet — just the engine architecture described in copy.

**Emotional register:** Understanding. The first expository beat. "Oh — they have an actual technical insight. Pre-baked at compile time. O(1) sampling. This is why it performs."

**The realization that should click:** "This isn't just Three.js wrapped in React. This is an actual compiler that generates animation frames. That's why it can do what it does."

**Transition emotion:** Interest — specifically the interest of someone who recognizes a real technical idea.

---

### Act 2: The Ecosystem

**What the visitor experiences:** Four package cards appear. The modular architecture becomes visible.

**Emotional register:** Scope. "It's bigger than I thought." And also relief: "I can start with just `@brewsite/core` and add what I need."

**The realization that should click:** "This isn't a single monolith I'm betting my project on. It's a set of composable packages with the same design language. I take what I need."

**Note on the chart card (coming soon):** The "↗ soon" badge should not feel apologetic. It should feel like: "This is already planned. The design is done. The architecture note is public." The chart card should make the visitor want the chart package to ship, not feel like they're being teased with vaporware.

**Transition emotion:** Confidence in the ecosystem. They want to see each package demonstrated.

---

### Act 3: Models

**What the visitor experiences:** A 3D character model with PBR materials, floor mirror, real lighting.

**Emotional register:** Visual quality confirmation. "OK, this is production quality. This is not a toy demo."

**The realization that should click:** "I drop a GLTF and it handles the materials, the lighting, the animation clips, the floor mirror. The model scene I was afraid would take three weeks takes an afternoon."

**Transition emotion:** Relief. The output quality is real.

---

### Act 4: The Crowd

**What the visitor experiences:** 30 animated characters (desktop), each with unique animation clips, procedurally placed — 50 lines of JSX.

**Emotional register:** Surprise → delight. The scale-to-code ratio is absurd. "30 characters. 50 lines. How?"

**The realization that should click:** "The pre-baked compiler is what makes this possible. All 30 characters' animations were resolved at compile time. Runtime just plays back the track."

**Transition emotion:** Confidence in scale. If the toolkit handles 30 animated characters on a phone, it can handle their project.

---

### Act 5: Simple Diagram

**What the visitor experiences:** A 5-node architecture diagram, neon cyber theme, tilted in 3D space.

**Emotional register:** Recognition. "I've drawn this diagram in Notion 100 times. I've never seen it look like this."

**The realization that should click:** "I can take the whiteboard diagram my team already has and render it in 3D with real AWS icons, edge routing, and a visual theme. Without a designer."

**Transition emotion:** Wanting to try it. The diagram looks achievable.

---

### Act 6: Architecture Diagram

**What the visitor experiences:** A multi-tier architecture diagram. Then a drill-down: the diagram stays in view while zooming into one subsystem.

**Emotional register:** Ambition. "This is what I wanted to build and never could."

**The realization that should click:** "The ghost node pattern means I can drill down into part of the diagram while keeping the rest in frame at reduced opacity. The scene system handles that automatically — I don't write any visibility logic."

**Transition emotion:** The desire to architect something with this.

---

### Act 7: Full Stack (Everything Together)

**What the visitor experiences:** A model AND a diagram in the same scene. HUD overlay. Multiple elements composing together.

**Emotional register:** Synthesis. "Everything I've seen so far is composable. The model, the diagram, the HUD copy, the environment — it's all one engine."

**The realization that should click:** "This is what a real product looks like. This is the pitch deck scene or the product demo page scene. I can build this."

**Transition emotion:** Readiness. The visitor is ready to start.

---

### Act 8: GitHub CTA

**What the visitor experiences:** A terminal card. An install command. A star button.

**Emotional register:** Clarity. No more story — just the path forward. "Here's where you start."

**The feeling they leave with:**
The room was dark. The sign powered on. They saw the product argue for itself — not through slides and screenshots but through live scenes running in their browser. They understood what it does and why it works. They know it's real, it's performant, and it's TypeScript all the way down. Now they install it.

---

## 7. The Chart Library — Positioning and Demo Strategy

### The Positioning Problem

`@brewsite/chart` is currently invisible on the site except for a "↗ soon" badge on the hero. This is technically accurate but strategically weak. Here's the issue:

The chart package is not "coming soon" in the way vaporware is coming soon. The architecture note is written. The implementation plan is complete. The key architectural decision — D3 math modules → native Three.js geometry, not a canvas texture — is already made and documented. The chart demo will be meaningfully better than any competing approach.

The strategic opportunity: use the "coming soon" positioning not as a disclaimer, but as a hook.

### The Correct Framing: "The Complete Data Storytelling Toolkit"

The four packages together tell a story that no competitor can tell:

> **3D models. Architecture diagrams. Data charts. In the same scene. In the same React tree.**

Spline can do models. Diagram tools can do diagrams. Charting libraries can do charts. Nothing puts all three in the same coordinate system with the same lighting, the same camera, and the same declarative authoring model.

This is the "complete toolkit" play — and it works because it's architecturally true. The same `EngineProvider`, the same `SceneTrack`, the same widget SDK powers all four packages. It's not a marketing bundle — it's a real common foundation.

### What Makes the Chart Demo Stand Out

The single most compelling chart demo for BrewSite is NOT a bar chart or a line chart. It is the **3D heatmap with a raised height dimension**.

Here's why: every 2D charting library does bar charts and line charts. The heatmap with height encoding is where 3D becomes genuinely informative, not decorative. A geographic grid where:
- X position = region
- Y position = product category
- Cell color = revenue
- Cell height = growth rate

This is a 4D visualization that you literally cannot show in 2D without adding a legend and making the viewer do mental work. In 3D, the camera angle reveals both dimensions simultaneously. The bars cast shadows on the floor plane. The environment light catches the glass material.

**The chart demo headline:** "The bars cast shadows. Because they're real."

**Secondary demo:** The scatter plot with real raycasting — hover a data point, it highlights. This shows the interaction model and proves it's not a static texture.

### The "Coming Soon" Amber Badge

Do not remove the amber "↗ soon" badge from the chart card. But change the ecosystem card body copy from:

> "Charts and visualizations in 3D."

To:

> "Native 3D charts. D3 math. Real geometry. Bars cast shadows."

This is more specific and signals architectural confidence, not just a feature description. The developer reading it understands what "native 3D" and "real geometry" means — they know the alternative (canvas texture) and why it matters.

Consider adding a dedicated pre-launch section or expandable detail that explains the approach. The architectural choice to reject ECharts (due to pnpm issues, abandoned React wrapper, 200–350KB bundle) and build on D3 math instead is itself a compelling story for the developer audience. It shows the team understands the dependency chain, cares about bundle size, and has a principled approach to the problem.

---

## 8. The 3D Character/Model Story

### What the Models Actually Are

The models appearing on the BrewSite website are not abstract geometric shapes. They are:
- A Worker character (used in the model demo)
- 30 human characters in a meeting room (the crowd scene)

These are GLTF characters with multiple animation clips, bone skeletons, and PBR materials. They stand on a reflective floor. They cast shadows. Each one has a unique assigned animation clip. Some are gesturing. Some are walking. Some are standing still.

### What They Say About the Brand

The character models send three messages:

**1. The output quality is production-grade.**
When you see a realistically lit, physically-based 3D character standing on a mirror-finish floor, you know this isn't a toy. The materials are right. The lighting is right. The scale is right. It looks like something that belongs in an Apple product presentation, not a tutorial project.

**2. The scale claims are honest.**
"30 characters. 50 lines of JSX." is not a marketing exaggeration. You can see 30 characters in your browser right now, animated, on a phone, without frame drops. The pre-baked compiler claim is visibly true.

**3. BrewSite handles the hard stuff — humans.**
Characters are the hardest 3D asset class to handle well. They have complex skeletons. Their materials require careful PBR tuning. Their animations need clip blending. If BrewSite can render 30 animated human characters on a phone, it can render anything a marketing site needs.

### How to Talk About Them

Do NOT say:
- "Lifelike 3D characters" (oversells the realism)
- "Animated avatars" (undersells the technical depth)
- "3D people" (too literal)

DO say:
- "GLTF characters with animation clips"
- "30 characters, each with a different animation assignment, rendered on a phone"
- "Drop any GLTF. The renderer handles materials."

The character models are proof, not decoration. Talk about them as proof.

### The "50 Lines of JSX" Story

The meeting scene is the best argument BrewSite has for the authoring model. 30 independently animated characters, procedurally placed (random seed, collision detection), each with a unique animation assignment — authored in ~50 lines of declarative JSX.

This is the "one engine, infinite forms" proof point. It makes abstract claims about scalability and declarative authoring concrete. If you want the site to convert developers, this scene and its copy are doing heavy lifting.

The copy "30 characters. 50 lines of JSX." should be on the site exactly as-is. It's correct. It respects developer intelligence. Don't explain it. Trust that a developer reading it knows why that ratio is remarkable.

---

## 9. Specific Headlines and Taglines

### 10 Candidate Section Headlines

Use these across the site, in documentation, in social content, in any context where a headline is needed.

**1. For the engine (act 1):**
"No animation loops. No frame math. Just describe the scene."

**2. For the compiler innovation:**
"Pre-baked at compile time. O(1) at runtime. Your animation runs like a film projector."

**3. For the model system:**
"Drop a GLTF. Animate the world."

**4. For the crowd/scale proof:**
"30 characters. 50 lines of JSX."

**5. For the diagram system:**
"From whiteboard to 3D. No Figma required."

**6. For the architecture diagram:**
"Drill down. Stay in the scene."

**7. For the full stack scene:**
"One engine. Infinite forms."

**8. For the chart package:**
"The bars cast shadows. Because they're real."

**9. For the ecosystem:**
"One engine. Four packages. Take what your story needs."

**10. For the GitHub CTA:**
"Built for TypeScript. Powered by React. Install the engine, then add only what your story needs."

---

### 5 Candidate Product Taglines

These are for the overall product — the one-liner that lives in the hero, in documentation, in social bios, in conference talks.

**Option 1 (currently shipped — keep it):**
> **"Scenes as React. Rendered like film."**

This is correct. It's short. It's specific. It does two things at once. Keep it unless there's a strong reason to change.

**Option 2 (compiler-focused):**
> **"Write the scenes. The compiler writes the film."**

More evocative of the compilation model. Slightly more poetic. The word "film" connects back to the current tagline's DNA.

**Option 3 (authoring-focused):**
> **"Author in React. Ship in three dimensions."**

Functional but less emotionally resonant. The "three dimensions" is a little literal.

**Option 4 (short/provocative):**
> **"3D storytelling. In React."**

Reversing the current positioning line. Works as a very short version. Could precede the longer tagline.

**Option 5 (proof-forward):**
> **"30 characters. 50 lines. No frame math."**

This is a bold call — leading with proof rather than category. Works extremely well for developers who are skeptical of marketing claims. Less versatile as a product tagline (too specific), but could anchor specific campaigns.

**Recommendation:** Keep "Scenes as React. Rendered like film." It's already correct. It appeared in the locked hero. It should be the canonical tagline.

---

## 10. Vocabulary List

### Words to Use

| Word/Phrase | Why |
|---|---|
| declarative | Technically accurate; resonates with React developers |
| pre-baked | Specific to the compiler innovation; not used by competitors |
| scene | BrewSite's core abstraction unit; use consistently |
| compile / compiled | Reinforces the "this runs through a compiler" mental model |
| toolkit | Modular — not a framework, not a library, not a platform |
| ecosystem | Signals maturity and composability |
| O(1) sampling | Use in technical context; developers who know what it means will appreciate it |
| widget | BrewSite's extension model; use for the SDK |
| GLTF | Use the correct acronym; don't say "3D model file" |
| PBR materials | Physically-based rendering; correct term; developers who do 3D know it |
| DSL | Domain-specific language; accurate; use in technical contexts |
| track | The `SceneTrack` — use to refer to the compiled output |
| ghost node | BrewSite's drill-down technique; specific and evocative |
| storytelling | The use case, not the mechanism; keeps focus on the output |
| scroll-driven | Accurately describes the primary interaction model |
| TypeScript-first | Accurate; a feature, not just a buzzword here |
| edge routing | Correct diagram term; use it |
| environment map | The HDR lighting technique; correct and specific |

---

### Words to Avoid

| Word/Phrase | Why Not |
|---|---|
| easy / simple | Insulting to developer intelligence; implies no learning curve (there is one) |
| powerful | Unmeasurable; say specifically what it can do instead |
| stunning / beautiful / gorgeous | Decorative adjectives; trust the visuals to convey this |
| seamless | Cliché in SaaS marketing; meaningless |
| intuitive | Subjective and untestable; never actually true |
| next-level / next-gen | Pure filler |
| modern / cutting-edge | Every product claims this; means nothing |
| robust | Enterprise-speak |
| transform / revolutionize | Overused; creates credibility debt |
| boilerplate-free | The product has an integration cost; don't lie |
| get started in minutes | There's no playground yet; this is currently untrue |
| no-code | There is absolutely code; this would be a lie |
| just | Diminishes the actual complexity of what the toolkit does: "just write JSX" sounds trivial |
| leverage | Corporate-speak; just say "use" |
| utilize | Say "use" |
| delightful | Design-speak that means nothing to developers |
| magic | Actively harmful — suggests you shouldn't understand how it works |
| Author in JSX | Use "Author in React" — JSX is syntax; React is the paradigm |
| animation | Be specific: "scene transitions," "model animation clips," "scroll-driven playback" |
| 3D experiences | Too vague; be specific about what kind of 3D content |
| interactive | Says nothing; be specific about the interaction model |

---

## Appendix: Notes on the Hero Scene (the constraint)

The first scene is locked. Any brand strategy that contradicts its tone fails.

The hero does four things:

1. **It's cinematic before it's communicative.** The room is dark for several seconds before a word appears. The visual experience precedes the positioning statement. This is a deliberate choice that says: "our product looks like this, and we're confident enough to make you wait."

2. **The typography is restrained.** Mono eyebrow (11px, letter-spaced). Large gradient headline. Small-caps tagline. No decorative elements competing with the neon sign.

3. **The color palette is specific.** Deep near-black (#050910). Electric cyan (#00f5ff). The cyan-to-white gradient. Warm amber for the chart badge. The brand colors are in the scene, not just in the CSS.

4. **The vibe is "high-craft studio" not "startup."** The rivet bezel, the reflective floor, the warm + cool industrial lighting — this product was made by people who care about what things look like. The brand strategy should feel like it came from the same place.

Any copy that sounds like a Webflow template, a product hunt launch, or a medium blog post introduction is out of voice. Any visual addition that doesn't belong in a dark industrial metal room is out of voice.

The brand is the room. Everything extends from the room.
