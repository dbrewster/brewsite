---
title: "Documentation Site — Open Questions"
doc_type: plan
status: draft
owner: brewsite-product-manager
last_updated: 2026-02-28
change_history:
  - date: 2026-02-28
    author: "Toolkit Product"
    summary: "Initial questions document created. Captures all design decisions, product choices, and technical uncertainties that surfaced during documentation planning. Organized by priority — resolve highest-priority items before implementation begins."
---

# Documentation Site — Open Questions

This document captures all open questions that arose during documentation planning. They are grouped by topic and roughly ordered from highest to lowest priority. Resolve the **Priority 1** items before implementation begins. Priority 2 and 3 items can be decided during implementation.

---

## Priority 1 — Must Resolve Before Implementation

---

### Q1: Where does the docs site live — `apps/docs` (new) or `apps/website` (existing)?

**Context**: `apps/website` already exists as a stub with an essentially empty `App.tsx` (just a `<Routes>` shell with no routes). It has the correct dependencies (`@brewsite/core`, `@brewsite/diagram`, React, Three.js) and a `vite.config.ts` with the correct source aliases.

The two plans assume a new `apps/docs/` workspace. But there's a strong argument for using the existing `apps/website` since:
1. It already has the right setup
2. The intent seems to be that this website serves the docs
3. Avoids a new workspace with redundant toolchain config

**Options**:
- **A** (recommended): Use `apps/website` for docs. Rename mentally, keep the `@brewsite/website` package name, and build the docs app into it. The plans' `apps/docs/` path becomes `apps/website/`. All other implementation detail stays the same.
- **B**: Create `apps/docs/` as a new separate workspace. Keep `apps/website` as a future "marketing landing page" app.
- **C**: Create `apps/docs/` for docs and fold into `apps/website` later.

**Impact**: High — all file paths in the plans change if option A is chosen.

---

### Q2: Should model-dependent doc pages have live demos or code-only?

**Context**: `@brewsite/core`'s Model element page (and Labels, which depends on model bones) cannot show a live 3D widget without a GLTF model file. The plans currently call for code-only on these pages, with notes pointing users to the examples app for live model demos.

**Options**:
- **A** (plans assume this): Code-only for model-dependent pages. Show syntax-highlighted code; link to `apps/examples/` for live experience. Keep docs app asset-free.
- **B**: Include a minimal sample GLTF (< 50KB, procedural cube or capsule) in `apps/docs/public/assets/` to enable a live model demo. This requires generating or sourcing the asset.
- **C**: Use a remotely hosted sample GLB (e.g., Three.js's default box.glb). Requires network access in docs.

**Impact**: Medium — affects the Model, Labels, and Contained Model doc pages. Option A is the lowest-friction path.

---

### Q3: What base URL/path will the docs be served from?

**Context**: Vite's `base` option in `vite.config.ts` must be set correctly for all asset paths to work on the deployment host.

**Options**:
- `'/'` — docs are served from the root of a dedicated domain (e.g., `docs.brewsite.dev`)
- `'/docs/'` — docs live under a subdirectory of the main site (e.g., `brewsite.dev/docs/`)
- `'/brewsite/'` — GitHub Pages default subdirectory (e.g., `your-org.github.io/brewsite/`)

**Impact**: Must be set in `vite.config.ts` before building. Can be an environment variable so different deployments can use different paths.

---

### Q4: Who owns the `apps/website` package today, and is it in active use?

**Context**: `apps/website` has a nearly empty `App.tsx` with only the React Router `<Routes>` shell. It has a `siteResources.ts` suggesting it may have had or planned scene-based content. It has a `src/landing/` directory not yet explored.

**If the website has planned content**: The docs should be a section of it (e.g., `/docs/*` routes within the website app). This affects the sidebar layout — it needs to coexist with other routes.

**If the website is a stub placeholder**: We can freely repurpose it as the docs app.

---

### Q5: Does the `DiagramWidget` constructor require a `theme` argument?

**Context**: The `diagramDemoSetup.ts` file in the diagram plan calls `new DiagramWidget('diagram')`. The actual constructor signature for `DiagramWidget`, `DiagramCanvasWidget`, `ImagePanelWidget`, and `ScreenWidget` was not verified against source during planning (source verification was deferred to implementation).

**Resolution required before demo files are written**: Read `packages/diagram/src/elements/diagram/widget.ts`, `canvas/widget.ts`, `image-panel/widget.ts`, and `screen/widget.ts` to determine:
1. Exact constructor parameter list for each
2. Whether a theme/registry/options object is required
3. Whether widgetId is a constructor arg or a class property

**Impact**: Medium — affects all four diagram demo setup functions.

---

## Priority 2 — Decide During Implementation Phase 1

---

### Q6: Should there be a search bar?

**Context**: Developer documentation without search is frustrating once the content grows beyond ~20 pages. The plans explicitly exclude search in v1.

**Options**:
- **A** (planned): No search in v1. Add in v2 after content settles.
- **B**: Add Algolia DocSearch (free for open source docs). Requires an Algolia account and a crawler config.
- **C**: Add client-side search using `flexsearch` or `fuse.js` with an index built at build time.

**Recommendation**: Start with option A. Add Algolia in v2 if usage analytics show search frustration.

---

### Q7: Should demos auto-play when scrolled into view?

**Context**: The `DemoScene` component has an auto-play toggle. But the default behavior (autoplay off) means the first time a user sees a demo, it's frozen at scene 1.

**Options**:
- **A** (planned): Auto-play is a toggle the user enables. Default off.
- **B**: Demos auto-play when their container scrolls into the viewport (using `IntersectionObserver`). Looping.
- **C**: Demos auto-play always, looping continuously.

**Recommendation**: Option B — auto-play on scroll-into-view feels polished and demonstrates the product without requiring user interaction. Easy to implement with `IntersectionObserver`.

---

### Q8: Dark mode only or light/dark toggle?

**Context**: The plans specify dark-mode-only. Most developer tools and docs (Tailwind, Next.js, Three.js) are dark-mode.

**Options**:
- **A** (planned): Dark mode only. Fixed palette.
- **B**: System preference (`prefers-color-scheme`) — dark or light based on OS setting.
- **C**: Toggle button to switch.

**Recommendation**: Start with dark-mode only (option A). The diagram demos especially look better on dark backgrounds, and the `lightMinimalTheme` demo would look odd on a light docs page.

---

### Q9: Should the docs site have analytics?

**Options**:
- **A**: No analytics. Privacy-first, no third-party scripts.
- **B**: Plausible Analytics (privacy-friendly, no cookies, simple script).
- **C**: Google Analytics.

**Recommendation**: Option B if any analytics are desired. Option A is the simplest to ship.

---

### Q10: Should API reference be hand-written or auto-generated from TypeScript?

**Context**: The plans call for hand-written API reference pages. TypeDoc or a similar tool could auto-generate them from the TSDoc comments in source.

**Options**:
- **A** (planned): Hand-written API reference. More control, stays in sync manually.
- **B**: TypeDoc-generated API site, linked from the hand-written docs. Two separate outputs.
- **C**: TypeDoc integrated into the Vite docs app (using `typedoc-plugin-markdown` to produce MDX).

**Recommendation**: Start with option A. The PRDs are already excellent API documentation. Hand-written reference pages that distill the PRD content are more readable than auto-generated TypeDoc output.

---

### Q11: Should the docs have versioning (e.g., v0.4, v0.5)?

**Context**: `@brewsite/core` is at `0.4.2` and `@brewsite/diagram` at `0.1.0`. As these evolve, doc content will diverge from older published versions.

**Options**:
- **A**: Single version — always tracks the `main` branch HEAD. Simpler.
- **B**: Versioned docs — each major/minor release gets a frozen snapshot. Requires a versioning system.

**Recommendation**: Option A until the packages reach 1.0. After 1.0, evaluate option B.

---

### Q12: What should the favicon look like?

The plans include a `favicon.svg` in `public/`. The BrewSite brand identity needs to be defined or provided.

**Resolution**: Provide a favicon SVG (the BrewSite logo or a simple "B" wordmark in accent blue). This is a design asset question, not a code question.

---

## Priority 3 — Low Urgency, Can Decide After v1 Ships

---

### Q13: Should the `apps/examples` scenes be linked from the docs?

**Context**: The examples app has rich, full-page scenes with real models. It's the best demonstration of what's possible. The docs could link to a deployed version of `apps/examples` for full-scene demos.

**Question**: Is `apps/examples` deployed anywhere publicly? Should the docs reference it?

---

### Q14: Should there be a "Playground" page?

A playground would let users edit scene DSL code directly in the browser and see the result. This is complex (requires browser-side TypeScript compilation or Monaco editor with a simplified setup).

**Recommendation**: Defer to v3+. The live demos with copy-able code achieve most of the benefit with much less complexity.

---

### Q15: How should the `apps/website/src/landing/` directory be handled?

There's a `landing/` directory inside `apps/website/src/` that was not explored during planning. It may contain marketing landing page content that should coexist with the docs.

**Resolution**: Read the landing directory contents and decide if they're active, stubbed, or deprecated. If active: integrate docs as a `/docs/*` subdirectory within the existing app. If stubbed/empty: repurpose the whole app as the docs site.

---

### Q16: Should diagram demos use the HDR environment map from `packages/diagram/public/`?

**Context**: `@brewsite/diagram` ships with an HDR environment map for rendering high-quality diagram materials. Docs demos would look better with it. But the env map file lives in `packages/diagram/public/assets/envmaps/` and would need to be accessible to the docs Vite dev server.

**Options**:
- **A**: Configure docs Vite server to serve `packages/diagram/public/` as a static directory.
- **B**: Copy the env map to `apps/docs/public/assets/envmaps/` (or `apps/website/public/`).
- **C**: Skip the env map in docs demos — use a simpler lighting setup.

**Recommendation**: Option C for v1. The demos look good without the HDR env map and it simplifies the asset setup. The env map can be added in v2.

---

### Q17: Should diagram icon registry be populated for icon-shape node demos?

**Context**: `DiagramNode` supports icon shapes from the Heroicons and cloud provider icon libraries. These are populated via the `sync:icons` script (`pnpm sync:icons`). The docs diagram demos would benefit from showing icon-shape nodes (AWS, GCP, Azure icons).

**If populated**: Icon-shape demos become available. Requires running `pnpm sync:icons` as part of the docs build.

**If not populated**: Demos use non-icon shapes only (pill, hex, circle, diamond, rectangle). Still works, but misses a compelling feature.

**Recommendation**: Populate the icon registry in the docs build. Add `pnpm sync:icons` to the docs prebuild step in `turbo.json`. Then a small set of icon shapes (3–5 examples) can be used in the Nodes demo.

---

### Q18: Should the `DiagramCanvas` focus-region demo require `EngineInputRegion`?

**Context**: The `DiagramFocusRegion` demo requires click events on diagram nodes to trigger `canvas.focus`. This needs `EngineInputRegion` wrapping the player, and `InputController` + `Action` DSL in the scene. This adds complexity to the demo component.

**Question**: Is there a simpler way to show `useDiagramFocusRegion` without requiring the full `InputController` setup?

**Resolution**: The focus region hook can be demonstrated with a programmatic trigger (a button that calls `getDiagramFocusRegion` / sets a node focus directly) as an alternative to the full click-to-focus interaction. Simpler for a docs demo.

---

### Q19: Code style in docs examples — should it exactly match the project's conventions?

**Context**: The project uses 2-space indentation, semicolons, and named exports. Code in the docs should match this for credibility. The plans' code samples already follow these conventions.

**Question**: Should the `CodeBlock` components run Prettier formatting on the code before display, or rely on hand-written formatting?

**Recommendation**: Hand-written. Running Prettier at runtime in the browser is overkill. The code examples are hand-crafted and reviewed as part of the docs PR process.

---

### Q20: Should the docs cover the `TimelineWidget` and `CameraControlPanel` debug tools?

**Context**: `@brewsite/core` exports `TimelineWidget` and `CameraControlPanel` — debug components that show scene timeline and camera position overlays. The current plans include these under the Player & Hooks section briefly.

**Question**: Should these get their own doc pages with live demos showing the debug overlays in action?

**Recommendation**: Include them as a subsection of the Player page, not separate pages. They are development/debugging tools, not primary authoring surface.

---

### Q21: Should the docs cover the `SceneInspector` component?

**Context**: `SceneInspector` is exported from `@brewsite/core`'s player. It's not mentioned in the PRDs examined during planning, suggesting it may be a recent or niche addition.

**Resolution**: Verify what `SceneInspector` does by reading its source before deciding if it warrants documentation.

---

## Summary Checklist

Before implementation begins, confirm decisions on:

- [ ] **Q1**: `apps/website` vs new `apps/docs/`
- [ ] **Q2**: Live model demos vs code-only
- [ ] **Q3**: Base URL for deployment
- [ ] **Q4**: State of `apps/website` — repurpose or separate?
- [ ] **Q5**: Diagram widget constructor signatures (read source files)

These five answers unblock Phase 1 (infrastructure) of implementation.
