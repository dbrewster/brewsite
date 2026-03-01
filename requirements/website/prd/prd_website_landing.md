---
title: "BrewSite Marketing Website — Landing Page"
doc_type: prd
status: approved
owner: Toolkit Product
last_updated: 2026-03-01
change_history:
  - date: 2026-02-28
    author: "Toolkit PM"
    summary: "Initial PRD created. Full scroll-driven landing page showcasing @brewsite/core and @brewsite/diagram across 8 acts. Makerspace/steampunk aesthetic anchored by a neon sign hero. Approved for implementation."
  - date: 2026-03-01
    author: "Toolkit PM"
    summary: "Complete rewrite. Mobile-first design philosophy adopted — portrait 9:16 is the primary viewport target; desktop adapts. Updated positioning to 'The React toolkit for 3D storytelling.' Hero gains Beat 2 (positioning statement appears after sign reveal). Tagline updated to 'Scenes as React. Rendered like film.' Act 2 (Libraries/HUD internal) replaced with Ecosystem act introducing all four packages (@brewsite/core, @brewsite/model, @brewsite/diagram, @brewsite/chart). Models compressed from 2 scenes to 1. GitHub CTA updated for multi-package install. All cameras redesigned for portrait-first composition. 2024 phones (A17 Pro, Snapdragon 8 Gen 3) are the performance baseline."
---

# BrewSite Marketing Website — Landing Page

## Overview

The BrewSite marketing website (`apps/website`) is a long-scroll, single-page showcase for the BrewSite ecosystem — `@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, and `@brewsite/chart`. It is the product's primary public-facing presence for technical evaluators: developers, technical PMs, and presentation authors who are deciding whether to adopt the toolkit.

The site is itself a proof of concept: it is built with the toolkit, demonstrating capabilities by using them. Every major feature — scroll-driven scenes, 3D models, animated crowds, immersive diagrams, and multi-layer compositions — appears as a real, rendered scene. The site argues for the toolkit by showing it working.

The page is designed **mobile-first**. The primary viewport is a 2024 smartphone in portrait orientation (9:16, approximately 390×844px). Desktop browsers receive the same experience with adapted camera framing. All cameras, all typography, all HUD layouts are composed for portrait first.

The aesthetic remains **steampunk makerspace meets high-tech**: industrial dark metal frames, riveted bezels, neon signs, warm amber + electric blue industrial lighting.

Target audience: TypeScript developers, technical PMs, and presentation authors evaluating the toolkit for marketing pages, slide decks, pitches, and product demos.

---

## Problem Statement

The toolkit has evolved significantly since the original website was designed. It is now a modular ecosystem of four packages, not a single library. The original messaging — "Author in JSX. Ship to any surface." — understates the product and misrepresents the authoring model (JSX is the syntax; React is the paradigm). The ecosystem story is invisible: visitors see two packages in the hero when four exist.

Mobile usage dominates web browsing. A website that isn't designed for phones is not designed. The original site was desktop-first with three afterthought mobile rules in CSS. This is corrected by making portrait 9:16 the primary design target throughout.

The product's core positioning — "The React toolkit for 3D storytelling" — is owned by no competitor in the animation/visualization library landscape. Theatre.js approaches it from the toolbox angle; Remotion approaches it from the video-output angle. BrewSite owns the intersection of React-native, scroll-driven, 3D, and storytelling. The website must claim this position explicitly.

---

## Goals & Success Metrics

**Primary Goals:**
- A visitor on a phone understands what BrewSite does within 30 seconds of reaching the hero
- A visitor who scrolls the full page can enumerate all major ecosystem packages and their capabilities
- Every 3D section is a real EngineProvider rendering real scenes — no static screenshots
- The install command and GitHub link are reachable within 2 scrolls on any device

**Success Metrics:**
- Hero comprehension: A developer unfamiliar with BrewSite can describe its core capability after seeing the hero + Beat 2 reveal, without reading further
- Mobile render: All scenes render at acceptable frame rate on an iPhone 15 and a Pixel 8 in Chrome
- Mobile layout: No horizontal scroll, no clipped text, no illegible font sizes at 390px viewport width
- Performance: Hero section displays before any GLTF assets load; First Contentful Paint < 2s on a fast mobile connection
- Demo fidelity: All scene acts render with no console errors on Chrome (mobile + desktop) and Safari (iOS)

**Guardrail Metrics:**
- No changes to `@brewsite/core`, `@brewsite/model`, or `@brewsite/diagram` package APIs
- `apps/website` remains a private app, not published to npm
- No changes that affect `apps/examples`

---

## Non-Goals

- Dark/light mode toggle — dark only
- Internationalization — English only
- CMS-driven content — authored directly in React/TSX
- A docs site — this is marketing, not reference documentation
- Interactive editor or playground — future scope
- Server-side rendering — this is a Vite SPA
- Landscape-optimized mobile layouts — portrait is the target; landscape on mobile is acceptable but not optimized
- Accessibility full compliance for WebGL content — best-effort `aria-hidden` on canvases; text content is accessible

---

## Consumer Stories

*"Consumer" = a visitor to the website.*

1. As a developer on my phone, I want to understand what BrewSite is and why it matters within 30 seconds so I can decide whether to come back on a laptop.
2. As a developer evaluating tools for a marketing project, I want to see the toolkit's output quality live in the browser so I can assess whether it matches what I'm imagining.
3. As a PM evaluating tools for my team, I want to understand what each package does without reading documentation so I can communicate the value to engineering.
4. As a developer unfamiliar with Three.js, I want to see that the DSL abstracts away graphics programming so I feel confident I can adopt it.
5. As a developer ready to start, I want a clear install command for exactly the packages I need so I can get running immediately.

---

## Functional Requirements

1. The site shall render in a single continuous scroll on any viewport from 375px to 2560px wide.
2. The hero section shall fill 100dvh (dynamic viewport height, for mobile browser chrome) and display a cursive neon "BrewSite" sign in a Three.js metal room.
3. The hero shall have two distinct visual beats: Beat 1 (sign reveal, 0–40% scene progress) and Beat 2 (positioning statement appears in upper bezel area, 42–58% scene progress).
4. Beat 2 shall display: eyebrow "The React toolkit for" + display headline "3D storytelling." using gradient display typography, positioned in the upper portion of the bezel frame.
5. The hero tagline shall read "Scenes as React. Rendered like film."
6. The hero package badges shall show all four packages: `@brewsite/core`, `@brewsite/model`, `@brewsite/diagram`, `@brewsite/chart`. The chart badge shall carry a "soon" visual indicator.
7. A fixed hamburger menu shall be accessible at all times and reveal a slide-out navigation panel with anchor links to each act.
8. Eight acts shall appear in sequence following the hero, each with its own visual identity.
9. Acts 1 through 7 shall use `EngineProvider` rendering real compiled scenes.
10. Act 8 (GitHub CTA) shall be a CSS-only terminal section.
11. On screens narrower than 768px, `EngineProvider` shall use `quality="balanced"`. On screens ≥ 768px it shall use `quality="high"`.
12. Meeting scene (Act 4) shall render 8 characters (4 pairs) on screens narrower than 768px and 30 characters (15 pairs) on wider screens.
13. Floor mirror resolution shall be 512px on screens narrower than 768px and 1024px on screens 768px and wider, for the hero scene only. All other mirror scenes use 512px universally.
14. All scenes shall use camera positions and FOV designed for 9:16 portrait viewports, with desktop variants provided where the composition materially differs.
15. All text in scene HUD overlays shall use `clamp()` font sizing — no hardcoded pixel values.
16. The page shall load and render without errors on Chrome 120+ (Android and desktop) and Safari 17+ (iOS and macOS).
17. The GitHub CTA terminal command shall install three packages: `@brewsite/core @brewsite/model @brewsite/diagram`.

---

## Positioning & Messaging

### Core Positioning Statement
**"The React toolkit for 3D storytelling."**

This statement appears in the hero Beat 2 and as the meta description. No competitor owns it. It names the technology (React, not JSX — React is the paradigm), the form (toolkit — modular packages, not a single library), the medium (3D), and the outcome (storytelling — the use case, not the mechanism).

### Hero Tagline
**"Scenes as React. Rendered like film."**

Replaces "Author in JSX. Ship to any surface." The distinction: React is the paradigm developers already respect and understand. "Scenes as React" means the scene authoring model IS the React component model — not just syntax-compatible. "Rendered like film" carries over from the original; it communicates pre-baked, deliberate, cinematic output. The claim is structural: BrewSite compiles scenes like a film editor assembles frames, not like a keyframe animator writes curves.

### Act Messaging Map

| Act | Eyebrow | Headline | Body |
|---|---|---|---|
| 0 (Hero) | [neon sign reveal] | "3D storytelling." | "Scenes as React. Rendered like film." |
| 1 (Engine) | @brewsite/core | "Scenes as React. Rendered like film." | "Declare states. Let the compiler handle transitions. No animation loops. No frame math." |
| 2 (Ecosystem) | The Ecosystem | "One engine. Four packages." | "Install only what you need. All packages share the same declarative scene model." |
| 3 (Models) | @brewsite/model | "Drop a GLTF. Animate the world." | "Metalness, roughness, normals — the renderer handles it. You handle the story." |
| 4 (Meeting) | Procedural Composition | "30 characters. 50 lines of JSX." | "Random placement, collision detection, animation assignment — all at author time. Runtime is just playback." |
| 5 (Diagrams) | @brewsite/diagram | "From whiteboard to 3D." | "Themes, icons, routed edges, groups. No Figma required." |
| 6 (Architecture) | Production Architecture | "Architecture diagrams. Presentation-ready." | "Drill down. Stay in the scene." |
| 7 (Full Stack) | Models + Diagrams + HUD + React | "One engine. Infinite forms." | "Web apps. Decks. Pitches. Marketing sites." |
| 8 (GitHub) | Open Source. Production Ready. | [terminal install] | "Built for TypeScript. Powered by React. Install the engine, then add only what your story needs." |

---

## Visual Design

### Mobile-First Layout Philosophy

All scenes are composed for a 9:16 portrait viewport (390×844px reference). Desktop viewports receive the same scene with the camera pulled back or FOV narrowed slightly to handle the wider aspect ratio. Horizontal composition is avoided — subjects and diagrams are centered on the X axis, with vertical arrangement used to create depth.

This inversion from the original design reflects a real behavioral reality: marketing websites are predominantly discovered and evaluated on phones. The site should be visceral and impressive on the device visitors actually hold.

### Hero Section

**Structure:** 100dvh. Three.js metal room (dark metallic back wall, reflective floor, warm + cool industrial lighting). CSS bezel frame over the canvas. Two-beat HTML overlay.

**Beat 1 (0–40% scene progress):** Sign powers on. No HTML content visible. The neon "BrewSite" sign flickers to life in the dark room.

**Beat 2 (42–58%):** Positioning statement fades in at the top of the bezel interior:
- Eyebrow line: "The React toolkit for" — 11px mono, letter-spaced, muted cyan `rgba(0,245,255,0.65)`
- Display headline: "3D storytelling." — `clamp(36px, 9vw, 72px)`, weight 700, gradient `#f0f6fc → #00f5ff`, letter-spacing `-0.03em`

**Beat 3 (52–65%):** Four package badges appear below the sign:
```
@brewsite/core    @brewsite/model
@brewsite/diagram  @brewsite/chart ↗soon
```
Arranged in a 2×2 flex-wrap grid, centered. The `@brewsite/chart` badge carries a small "soon" amber label.

**Beat 4 (63–75%):** Scroll indicator at bottom of viewport.

**Tagline line** (always visible once Beat 2 appears, below the display headline): "Scenes as React. Rendered like film." — 11px mono, small-caps, muted white. This sits between the eyebrow/headline group and the sign.

**Bezel:** Unchanged — CSS frame at `inset: 15% 8%` with L-bracket corners and rivet rows. On mobile portrait this frames ~70% of the viewport vertically. The positioning statement appears within the upper quarter of the bezel interior.

**NeonSign widget:** Unchanged. Stays fully lit throughout scene_00. Transitions to opacity 0 in the next scene (handled by scene_01's NeonSign state).

### Ecosystem Scene (Act 2)

Pure HUD scene — dark background, no 3D objects beyond camera and lighting. Four package cards in a 2×2 grid (on all viewports — this layout is naturally mobile-friendly and works well on desktop too):

```
┌──────────────────────┐  ┌──────────────────────┐
│  @brewsite/core      │  │  @brewsite/model      │
│  The engine.         │  │  GLTF models.         │
│  Declarative.        │  │  Characters.          │
│  Pre-baked. O(1).    │  │  Animations.          │
└──────────────────────┘  └──────────────────────┘
┌──────────────────────┐  ┌──────────────────────┐
│  @brewsite/diagram   │  │  @brewsite/chart      │
│  3D diagrams.        │  │  Data stories.        │
│  Architecture.       │  │  3D charts.           │
│  No Figma needed.    │  │  ↗ COMING SOON        │
└──────────────────────┘  └──────────────────────┘
```

Cards: `border: 1px solid rgba(0,245,255,0.18)`, `background: rgba(0,245,255,0.05)`, `border-radius: 8px`. Grid `gap: 16px`, `max-width: 520px`, centered. Package name in mono 10px cyan; headline in 600 weight; body in muted text.

"Coming soon" badge on chart card: amber `rgba(255,170,0,0.7)`, 10px mono.

Animation: MidFade on headline block, staggered SlideUp on each card (delay +100ms per card, starting 0ms).

### Section Design Language

Unchanged from original PRD — act headers, feature tags, code snippets, section dividers, rivet aesthetic.

---

## The Eight Acts

### Act 0: Hero — The Neon Sign

**Scenes:** `scene_00_hero.tsx` (1 scene, auto-advance)
**Narrative:** The room is dark. The sign flickers to life. Then the product declares itself.
**Visual:** Three.js metal room, CSS bezel, NeonSign widget "BrewSite", two-beat HTML overlay.
**Mobile camera:** `position={[0, 7, 17]}`, `target={[0, 1.4, 0]}`, `fov={52}` — no change needed, this composition works in portrait.
**ProgressManager:** `scrollUnits={1800}`, `autoAdvance={{ duration: 3, max: 0.80, pauseOnScroll: true }}`, `animationTimeScale={3}`

---

### Act 1: The Engine — Scenes & Core

**Scenes:** `scene_01_core_intro.tsx` + `scene_02_core_baked.tsx` (2 scenes)
**Narrative:** The engine itself. A dark background, a glowing HUD, text that explains the architectural innovation.
**Scene 1 headline:** "Scenes as React. Rendered like film." (updated from "Scenes as JSX.")
**Scene 2:** Pre-baked transitions, O(1) playback, feature tags: Declarative · Scroll-Driven · SSR-Safe · TypeScript-First · O(1) Sampling
**Mobile:** No 3D geometry — same on all viewports. Camera `[0,0,10]`, fov 70 works fine in portrait.

---

### Act 2: The Ecosystem — Four Packages

**Scenes:** `scene_03_ecosystem.tsx` (1 new scene, replaces `scene_03_hud_is_react.tsx` and `scene_04_transitions.tsx`)
**Narrative:** One engine, four packages. Install only what your story needs.
**Visual:** Dark space, four package cards appear in staggered sequence.
**Headline:** "One engine. Four packages."
**Sub-copy:** "Install only what you need. All packages share the same declarative scene model."
**Mobile:** 2×2 grid on all viewports. `max-width: 520px`, centered, padding `0 20px`.

**Files to delete:** `apps/website/src/scenes/act1_act2/scene_03_hud_is_react.tsx`, `apps/website/src/scenes/act1_act2/scene_04_transitions.tsx`

---

### Act 3: Models — @brewsite/model

**Scenes:** `scene_01_model_wide.tsx` (1 scene — the close-up scene is folded in via a HUD progression)
**Narrative:** Drop any GLTF. The renderer handles materials. You handle the story.
**Visual:** Worker character, floor mirror, industrial lighting. HUD has two phases: (1) "Drop a GLTF. Animate the world." then (2) "Physically Based. Floor-to-ceiling."
**ProgressManager:** `scrollUnits={2400}` (longer to accommodate two HUD phases), `autoAdvance={{ duration: 9, max: 0.85 }}`, `animationTimeScale={2}`
**Mobile camera:** `position={[0, 8, 28]}`, `target={[0, 5, 0]}`, `fov={65}`
**Desktop camera:** `position={[0, 8, 38]}`, `target={[0, 5, 0]}`, `fov={55}`
**Floor mirror:** `mirrorResolution={512}` (both viewports)
**Eyebrow:** `@brewsite/model`

**Files to delete:** `apps/website/src/scenes/act3/scene_02_model_close.tsx`

---

### Act 4: The Crowd — Procedural Composition

**Scenes:** `scene_01_meeting.tsx` (unchanged content, adjusted for mobile)
**Narrative:** 30 characters (desktop) / 8 characters (mobile), procedurally placed, all real animation clips. Authored in ~50 lines of JSX.
**Mobile camera:** `position={[0, 22, 70]}`, `target={[0, 0, 0]}`, `fov={60}`
**Desktop camera:** `position={[0, 34, 110]}`, `target={[0, 0, 0]}`, `fov={48}`
**Mobile PAIR_COUNT:** 4 (8 characters)
**Desktop PAIR_COUNT:** 15 (30 characters)
**HUD copy preserved exactly:** "30 characters. 50 lines of JSX." — the "30" refers to the desktop experience; acceptable on mobile where the same visual impact is achieved with 8 characters at closer camera range.

---

### Act 5: Diagrams — Simple

**Scenes:** `scene_01_simple_diagram.tsx`
**Narrative:** From whiteboard to 3D. No Figma. No designer.
**Visual:** 5-node tech stack, neonCyberTheme, tilted X-axis, glowing edges.
**HUD copy:** "From whiteboard to 3D." (drop "in JSX.")
**Mobile camera:** `position={[0, 10, 30]}`, `target={[0, 0, 0]}`, `fov={65}`
**Desktop camera:** `position={[0, 8, 40]}`, `target={[0, 0, 0]}`, `fov={55}`
**DiagramCanvas scale:** `scale={1.0}` on mobile, `scale={1.3}` on desktop

---

### Act 6: Architecture — Complex Diagrams

**Scenes:** `scene_02_arch_overview.tsx` + `scene_03_arch_detail.tsx` (2 scenes)
**Narrative:** Production-grade architecture diagrams. Drill down without leaving the scene.
**Mobile camera (overview):** `position={[0, 8, 38]}`, `target={[0, 0, 0]}`, `fov={65}`
**Desktop camera (overview):** `position={[0, 10, 50]}`, `target={[0, 0, 0]}`, `fov={55}`
**Mobile camera (detail):** `position={[0, 8, 35]}`, `target={[0, -5, 0]}`, `fov={65}`
**Desktop camera (detail):** `position={[0, 8, 45]}`, `target={[0, -5, 0]}`, `fov={55}`
**DiagramCanvas scale:** `scale={1.0}` on mobile, `scale={1.4}` on desktop (both scenes)
**HUD text:** All inline fontSize values updated to `clamp()` variants

---

### Act 7: Full Stack — Everything Together

**Scenes:** `scene_01_foundation.tsx` + `scene_02_combined.tsx` (2 scenes)
**Narrative:** One engine. All the packages. This is what a real project looks like.
**Scene 1 headline:** "One engine. Infinite forms." (updated from "Every medium.")
**Scene 2 sub-copy:** Updated from "Web apps. Decks. Pitches. Marketing sites." — keep this, it's good.
**Mobile camera (foundation):** `position={[0, 10, 40]}`, `target={[0, 4, 0]}`, `fov={65}`
**Desktop camera (foundation):** `position={[0, 12, 55]}`, `target={[0, 4, 0]}`, `fov={58}`
**Mobile camera (combined):** `position={[0, 12, 45]}`, `target={[5, 3, -5]}`, `fov={65}` (more frontal, less offset than desktop which is `-8` x offset)
**Desktop camera (combined):** `position={[-8, 14, 55]}`, `target={[5, 3, -5]}`, `fov={60}`

---

### Act 8: GitHub CTA

**Scene:** `scene_01_github.tsx` (CSS-only)
**Narrative:** You've seen what it can do. Here's where you start.
**Terminal command:**
```
$ pnpm add @brewsite/core @brewsite/model @brewsite/diagram
added 3 packages in 1.2s
```
**Headline:** "Open Source. Production Ready."
**Body:** "Built for TypeScript. Powered by React. Install the engine, then add only what your story needs."
**CTA:** "★ Star on GitHub →"

---

## Technical Considerations

### Mobile-First Implementation Pattern

A single `isMobile` boolean is computed once at module load time and shared across all scene files:

```typescript
// apps/website/src/utils/viewport.ts
export const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
```

This is evaluated at page load (always in a browser SPA context — no SSR) and remains stable for the session. Scene files import this constant to branch on camera positions, PAIR_COUNT, mirror resolution, DiagramCanvas scale, and font sizes where clamp() is insufficient.

All inline `fontSize` values in scene HUD elements that are currently hardcoded px values must be converted to `clamp(mobilePx, vwValue, desktopPx)`.

### Quality Setting

`EngineProvider quality` is set based on viewport:
```typescript
quality={isMobile ? "balanced" : "high"}
```

2024 phones (A17 Pro, Snapdragon 8 Gen 3 and later) can handle "balanced" quality across all scenes. If testing reveals a specific scene is problematic, the quality prop can be lowered per-EngineProvider instance.

### Height: 100dvh

The hero section and all EngineProvider-driven scenes use `100dvh` (dynamic viewport height) rather than `100vh`. On mobile browsers with collapsing address bars, `100vh` produces overflow; `100dvh` tracks the actual visible area.

### Multiple EngineProviders on One Page

Each EngineProvider (one per scene group) independently tracks scroll against its own container element. This is unchanged from the original implementation. Acts 1+2 share one EngineProvider; Acts 3, 4, 5+6, and 7 each have their own. This is valid and expected.

### Floor Mirror Resolution

Hero scene: `mirrorResolution={isMobile ? 512 : 1024}`. All other scenes: `mirrorResolution={512}` unconditionally. 2024 phones handle 512px mirror renders without performance issues.

### Touch Interaction

The EngineProvider scroll region handles touch scroll events. The page uses passive event listeners and native scroll. The `overscroll-behavior: none` on `html` prevents pull-to-refresh from fighting with scene scroll. No changes needed to the interaction layer.

### GitHub CTA Font Size

The terminal card uses hardcoded 14px — acceptable as a code aesthetic where fixed-width readability matters. All non-terminal text in the GitHub section uses `clamp()`.

---

## Breaking Change Assessment

**None.** `apps/website` is a private app. No published package APIs change. No `apps/examples` code changes. The deleted scene files (`scene_03_hud_is_react.tsx`, `scene_04_transitions.tsx`, `scene_02_model_close.tsx`) exist only in `apps/website` and are not imported anywhere else.

---

## Dependencies

- `@brewsite/core` workspace version
- `@brewsite/model` workspace version
- `@brewsite/diagram` workspace version
- `three` — for NeonSign widget
- `react` + `react-dom`
- `animejs` — for hud/animejs transitions
- Google Fonts CDN — Dancing Script (neon sign), JetBrains Mono (code), Inter (body)

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Portrait camera framing looks wrong on specific scenes | Medium | Each scene specifies both mobile and desktop camera values; test on physical device or DevTools portrait mode during implementation |
| 8-character meeting scene looks sparse on mobile | Low | Camera is significantly closer ([0,22,70] vs [0,34,110]) — 8 characters fill the tighter frame |
| Architecture diagram nodes overlap or are unreadable at mobile scale | Medium | Scale reduced from 1.4 to 1.0 on mobile; camera pulled closer; font sizes in DiagramCanvas are diagram-internal and scale with the canvas |
| Full stack combined scene (model + diagram side-by-side) loses impact on narrow mobile viewport | Medium | Mobile camera is frontal ([0,12,45]) rather than offset; both elements are in-frame at closer range |
| `100dvh` not supported in all target browsers | Low | Fallback in CSS: `min-height: 100vh; min-height: 100dvh;` — the `dvh` override applies when supported |
| @brewsite/chart package not yet shipped, badge misleads visitors | Low | "coming soon" amber label is explicit; no functionality implied |

---

## Open Questions

1. Should the `@brewsite/chart` badge link to a roadmap page or issues list, or have no link? (Recommendation: no link in v1 — just the visual badge.)
2. Is `quality="balanced"` the correct floor for 2024 phones, or should flagship 2024 devices (A17 Pro) get `quality="high"`? This can be determined by physical device testing during implementation.
3. Should the crowd scene HUD copy read "8 characters" on mobile (honest) or "30 characters" (true of the desktop experience)? The recommendation is to keep "30 characters" since the line refers to the authoring capability, not the current render count.
4. Does `EngineProvider` accept a `style` prop or `className` to set `height: 100dvh`? If not, a wrapper div must provide it.

---

## Launch Criteria

- [ ] Hero Beat 1 and Beat 2 both play correctly on iPhone (Safari) and Android Chrome in portrait orientation
- [ ] "3D storytelling." display headline is fully readable at 390px viewport width
- [ ] All four package badges appear in the hero (including `@brewsite/chart` with "soon" label)
- [ ] Ecosystem scene (Act 2) renders the 4-card grid legibly on a 390px screen
- [ ] Meeting scene renders 8 characters on mobile, 30 on desktop
- [ ] No horizontal overflow at any viewport from 375px to 2560px
- [ ] All scene HUD text is readable on mobile (no font sizes below 13px in practice)
- [ ] Camera framing verified on physical device or DevTools portrait mode for each scene
- [ ] GitHub CTA terminal shows 3-package install command
- [ ] All `console.error` output is clean on Chrome iOS, Chrome Android, Safari iOS, Chrome desktop
- [ ] `gen:scene-dsl` runs without errors and produces `/public/scene-manifest.json`
- [ ] TypeScript strict-mode build passes (`pnpm --filter @brewsite/website typecheck`)
- [ ] The hamburger nav opens and navigates to each act correctly
- [ ] `100dvh` hero height is correct on mobile (no overflow behind browser chrome)
