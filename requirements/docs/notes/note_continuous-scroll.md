---
title: "Continuous Natural-Scroll Docs Redesign"
doc_type: note
owner: brewsite-product-manager
status: reviewed
updated: 2026-03-05
change_history:
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Initial note. Problem statement, proposed per-panel EngineProvider solution, key design decisions, WebGL context budget, sidebar nav, eight open questions."
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Major revision. Three rendering strategies compared (multiple-contexts, context-pool, single-canvas scissor). Product owner decision: context pool of 2-4 is the chosen approach; unlimited individual contexts is a deal-breaker. Section 3.1 rewritten around three-way comparison. Section 3.3 corrected per PM-2 challenge: single-scene SceneTrack compiles to 1 tick (terminal state only); minimum 2 scenes required per animated panel; DWELL_FN claim retracted for single-scene case. Section 3.2 formula inconsistency resolved: animated panels must be >= viewport height; panels shorter than viewport show terminal state. Section 5 rewritten around context pool lifecycle. Section 6.2 extended with within-panel progress offset for multi-step panels (PM-2 challenge)."
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Follow-up revision per PM-2 challenges. Canvas DOM reparenting replaced with CSS overlay positioning (avoids Safari 15-17 webglcontextlost on detach). RuntimeLoop.pause()/resume() called out as explicit new toolkit requirement — does not currently exist. ContextPool ownership decision recorded: docs-app-only for v1 with clean interface seam for future @brewsite/core extraction. Open questions updated."
  - date: 2026-03-05
    author: "PM-2 (brewsite-product-manager)"
    summary: "Review complete. Status promoted to 'reviewed'. Consensus reached on all 7 challenges raised during debate. Final note materially stronger than initial draft: context pool replaces unbounded individual contexts; 2-scene minimum stated as hard compiler constraint with source evidence; scroll formula corrected for sub-viewport panels; within-panel nav restored via scrollToSection(id, progress?); Safari WebGL context loss risk resolved via CSS overlay (no DOM reparenting); RuntimeLoop.pause()/resume() declared an explicit toolkit requirement; ContextPool ownership scoped to docs-app-only v1 with extraction seam defined."
  - date: 2026-03-05
    author: "PM-2 verification pass"
    summary: "Second-pass verification. All 6 structural requirements confirmed present and correct. Added §7.7: open question on Three.js WebGLRenderer behavior under involuntary GPU-initiated context loss — CSS overlay eliminates reparenting-triggered loss but not driver-reset loss; implementation plan should note the risk and decide whether ContextPool needs webglcontextlost/restored listeners."
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Architecture superseded by product owner decision. No context pool, no fixed-position canvases, no CSS overlay positioning, no DOM reparenting. Each ScenePanel owns a real <canvas> in normal document flow. IntersectionObserver-driven WEBGL_lose_context lifecycle (loseContext() on exit, restoreContext() on re-entry with rootMargin: '200px' lookahead) bounds active GPU contexts to 1-2 at any time. EngineProvider receives a canvasRef pointing to the inline canvas; useCanvasContextLifecycle hook encapsulates acquire/release. Section 2.1 rewritten. Section 2.2 comment updated (ScenePanel is no longer a transparent placeholder). Section 3.1 Option B redefined as inline-canvas context lifecycle. Section 3.2 updated (IntersectionObserver role clarified — lifecycle, not progress). Section 4.1 DOM structure updated (no pool-canvas-root). Section 4.2 ScenePanel description rewritten. Section 5 replaced in full: ContextPool → IntersectionObserver context lifecycle with WEBGL_lose_context. Section 7.1 updated: RuntimeLoop.pause()/resume() now triggered by webglcontextlost/webglcontextrestored events. Former §7.2 (ContextPool extraction) removed — no pool exists to extract. Former §7.7 (involuntary context loss) absorbed into §5.3 and §7.1 as it is now central to the design. Open questions renumbered."
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Corrected §7.1 code example per PM-2 technical review. Removed non-existent renderer.forceContextRestore() call. Three.js WebGLRenderer (r158+) rebuilds its internal WebGL state automatically on webglcontextrestored via its own internal listener — no caller-facing API required. BrewSite's webglcontextrestored handler only needs to call runtimeLoop.resume()."
  - date: 2026-03-05
    author: "PM-2 final verification"
    summary: "Final verification pass on inline-canvas design. All structural requirements confirmed: no pool/fixed/sticky-canvas in recommendations; WEBGL_lose_context lifecycle fully and correctly described; RuntimeLoop.pause()/resume() declared explicit toolkit requirement in §7.1; 2-scene minimum compiler constraint intact; height >= 100vh scroll formula intact; scrollToSection(id, progress?) intact. §7.1 renderer.forceContextRestore() error confirmed fixed. Note is complete and accurate. Status remains reviewed."
  - date: 2026-03-05
    author: "PM-1 (brewsite-product-manager)"
    summary: "Closed three open questions with product owner decisions. §7.3: act headers are CSS-only (no ScenePanel, no WebGL, zero context lifecycle cost). §7.4: migration strategy is big-bang (no compatibility shim, old implementation deleted wholesale). §7.5: EngineProvider scrollSource viewport-relative mode is a @brewsite/core deliverable, not a docs-app concern — published API change must appear in the implementation plan as a toolkit task."
---

# Continuous Natural-Scroll Docs Redesign

## 1. Problem Statement

### 1.1 What the current system actually does

The current docs app (`apps/docs/`) renders a single `EngineProvider` wrapping a single sticky `SceneCanvas` that fills the right column of a two-column layout. There are 34 scenes totaling 73,200 scroll-units of height. The page's scroll budget (`scrollHeightPx={TOTAL_SCROLL_HEIGHT}`) is split across scenes using `<ProgressManager scrollUnits={N}>` inside each scene's JSX. As the user scrolls `window.scrollY`, `useEngineScroll` maps raw scroll position to engine progress, the SceneTrack sampler picks the current scene, and the global canvas updates its Three.js render state.

Content (prose, code blocks, callouts) is not in document flow. Every piece of documentation text lives inside a `DocPanel` component that is `position: absolute; inset: 0` — a floating overlay on top of the 3D canvas. `DocPanel` uses `useEngineState().sceneProgress` to animate itself sliding in from 80vh below the viewport. The canvas and its overlays together form one monolithic sticky viewport element.

### 1.2 Why this doesn't deliver natural-scroll docs UX

**The content is not a web page; it is a video with subtitles.** Users cannot:

- Ctrl+F / browser-find to locate text. The absolute-positioned overlays are technically in the DOM but appear and disappear based on scroll position — a user who searches for "ProgressManager" will find zero occurrences while the relevant scene is off-screen.
- Copy text normally without the page jumping (scroll events can displace content mid-select).
- Anchor-link to a specific section of documentation. Current deep-link (`#scene-what-is-brewsite`) scrolls to the correct offset, but the content is revealed only as an overlay — it is not a real heading in document flow with an `id` attribute.
- Read content at their own pace independent of animation state. The DocPanel only fully reveals after the first 25% of the scroll budget, then freezes.
- Use a screen reader. Absolutely-positioned overlays have no structural relationship to the document landmark hierarchy.

**The static pixel registry (`SCENE_SCROLL_REGISTRY`) is a maintenance liability.** Every `scrollUnits` value must be kept manually in sync with the `<ProgressManager>` in the corresponding scene file. They are two separate declarations of the same thing. When someone edits a scene's `scrollUnits` without updating `docs-nav.ts`, the sidebar navigation and deep-link URLs point to wrong scroll positions.

**The total scroll height (73,200px) is not tied to reading time.** The scroll budget per scene is an arbitrary pixel count tuned by hand. There is no connection between how much documentation content a scene contains and how many pixels of scroll it consumes.

**InlineDemo already breaks the single-engine model.** `InlineDemo.tsx` creates a second `EngineProvider` for every inline demo embedded in a DocPanel. The "single canvas" invariant is already violated in practice.

**Act header scenes consume scroll budget with no content.** Nine act scenes (`scrollUnits: 600` each) exist solely for visual transitions and contribute scroll dead-space with no readable content.

---

## 2. Proposed Solution

### 2.1 Core concept

Replace the sticky-canvas + overlay architecture with a **normal web document** where:

- Prose (headings, paragraphs, callouts, code blocks) is real HTML in normal block flow.
- Each 3D demonstration is an **inline `<ScenePanel>`** — a fixed-height block element in normal flow containing a real `<canvas>` element. It sits between prose blocks the same way an image or video would. The canvas scrolls with the page.
- The document scrolls normally. No sticky canvas. One continuous `<div>` from top of page to bottom.
- Each `<ScenePanel>` owns its WebGL context lifecycle. On first intersection (entering the viewport), `canvas.getContext('webgl2')` is called and the BrewSite engine attaches. When the panel scrolls out of view, `WEBGL_lose_context.loseContext()` releases the GPU slot. When it scrolls back in, `ext.restoreContext()` reclaims it. At any moment, only the 1–2 visible panels hold live WebGL contexts — Safari's ~8-context limit is never approached regardless of how many panels the page contains.

### 2.2 What a page section looks like

```
<div>                                  ← continuous document div

  <ActHeader title="Getting Started" /> ← CSS-only full-width banner, no canvas

  <ProseBlock id="what-is-brewsite">    ← real h1, p, CodeBlock, Callout in flow
    <h1>What is BrewSite Core?</h1>
    <p>@brewsite/core is a...</p>
    <CodeBlock language="bash" code="npm install @brewsite/core" />
  </ProseBlock>

  <ScenePanel                           ← block element with inline <canvas> in document flow
    id="scene-what-is-brewsite"
    height="calc(100vh + 400px)"
  >
    <Scene id="base">                   ← approaching pose (start state)
      <Camera position={[0, 3, 12]} ... />
      <Background color="#0a0a14" />
    </Scene>
    <Scene id="arrived">                ← reading pose (end state)
      <ProgressManager fn={DWELL_FN} />
      <Camera position={[0, 1.8, 8]} ... />
      <Background color="#0d0f1a" />
    </Scene>
  </ScenePanel>

  <ProseBlock id="how-it-works">        ← prose continues below the canvas
    <h2>How it works</h2>
    <p>Unlike timeline-based animation...</p>
  </ProseBlock>

  ...                                   ← and so on for all sections

</div>
```

---

## 3. Key Design Decisions

### 3.1 Rendering architecture: three options considered

Three strategies exist for putting multiple 3D scenes on a scrolling web page. All three were evaluated.

---

**Option A — One EngineProvider per ScenePanel (N independent WebGL contexts, always live)**

Each `<ScenePanel>` wraps its own `EngineProvider` + `SceneCanvas`. Clean isolation, existing API works unchanged.

*Why rejected:* Browser WebGL context limits (Chrome ~16, Safari ~8) are hard ceilings. The docs site has 25 content scenes. Exceeding the limit causes silent canvas blackouts — no error thrown in JS, engines keep ticking, nothing renders. Limiting the site to 8-16 illustrated scenes to stay within budget forces content decisions based on a technical constraint. This is a deal-breaker.

---

**Option B — Inline canvas per ScenePanel with `WEBGL_lose_context` lifecycle (chosen approach)**

Each `<ScenePanel>` renders a real `<canvas>` in normal document flow. An `IntersectionObserver` hook (`useCanvasContextLifecycle`) manages context acquisition and release:

- On first intersection: `canvas.getContext('webgl2')` → attach `EngineProvider` via `canvasRef` → start RAF loop.
- On exit: `gl.getExtension('WEBGL_lose_context').loseContext()` releases the GPU slot → `webglcontextlost` event fires → `RuntimeLoop.pause()`.
- On re-entry (200px before entering view): `ext.restoreContext()` → `webglcontextrestored` event fires → `RuntimeLoop.resume()`.

No fixed-position canvases. No CSS overlay positioning. No shared pool infrastructure. The canvas is a plain block element that scrolls with the page. At any moment only the 1–2 panels currently in or near the viewport hold live WebGL contexts.

`EngineProvider` receives a `canvasRef` pointing to the panel's inline canvas. Context acquisition and release are fully encapsulated in `useCanvasContextLifecycle`.

---

**Option C — One fixed background canvas, scissor-clipped regions**

One `<canvas>` is `position: fixed; inset: 0; z-index: -1`. The Three.js renderer uses `gl.scissor()` to paint only the pixel rectangles corresponding to visible panel placeholders. All panels render in one frame per scissor region. Three.js documents this pattern.

*Why deferred:* Requires `RuntimeDriverImpl` to support multi-scene-per-renderer rendering in a single frame — a significant architectural change to the widget tick model. The HTML content layer must have no background color in panel regions (fragile z-stack). The full-viewport canvas burns fill rate for mostly-prose pages. The EngineProvider abstraction breaks down. This is the correct long-term answer for maximum GPU efficiency but requires too much toolkit surgery to be a v1 choice.

---

**Decision: Option B (inline canvas + `WEBGL_lose_context` lifecycle).**

### 3.2 How does each ScenePanel know its scroll progress?

**Per-element scroll observer feeding `controlledProgress`.**

Each panel mounts a scroll observer when its engine is active:

```typescript
const panelHeight = ref.current.offsetHeight;
const viewportH = window.innerHeight;
const maxScroll = panelHeight - viewportH;

if (maxScroll <= 0) {
  // Panel shorter than viewport — no scroll traversal (see §3.4)
  engine.setControlledProgress(1);
  return;
}

const panelTop = ref.current.getBoundingClientRect().top + window.scrollY;
const scrolled = window.scrollY - panelTop;
const raw = clamp01(scrolled / maxScroll);
engine.setControlledProgress(raw);
```

The `getBoundingClientRect()` call on each scroll event captures live position, handling any layout reflow during the page's lifetime.

**Why not a shared scroll coordinator?** Per-panel listeners (`passive: true`) are cheap. A shared coordinator adds synchronization complexity with no performance benefit for this use case.

**Why not IntersectionObserver for progress?** IntersectionObserver reports discrete visibility thresholds, not a continuous value. It is used for context lifecycle management, not for smooth animation progress.

### 3.3 Minimum scene count and SceneTrack compiler constraint

**A ScenePanel must contain at minimum 2 scenes for scroll-driven animation to work.**

This is a compiler constraint, not a design choice. Verified against `sceneTrackCompiler.ts`:

With one scene: `numTransitions = 0`, `totalFrames = 1`. One tick is produced. The "fix last frame" pass hardcodes `sceneProgress = 1` on this tick. The sampler always returns `ticks[0]` regardless of input progress (`maxIndex = 0`, so `Math.min(0, ...) = 0` always). Feeding `controlledProgress = 0.5` to a single-scene engine shows the terminal pose. DWELL_FN has nothing to operate on.

With 2 scenes: the SceneTrack has a transition from scene 1 → scene 2. Progress [0..1] traverses this transition. DWELL_FN on scene 1 compresses the animation into the first 25% of progress and holds scene 2's state for the remaining 75%.

**Standard 2-scene panel pattern:**

```tsx
<ScenePanel id="what-is-brewsite" height="calc(100vh + 400px)">
  {/* Base state: camera approaching */}
  <Scene id="base">
    <Camera position={[0, 3, 12]} target={[0, 1, 0]} fov={50} />
    <Background color="#0a0a14" />
  </Scene>

  {/* Arrived state: reading position — animate in first 25%, dwell remaining 75% */}
  <Scene id="arrived">
    <ProgressManager fn={DWELL_FN} />
    <Camera position={[0, 1.8, 8]} target={[0, 0.8, 0]} fov={40} />
    <Background color="#0d0f1a" />
  </Scene>
</ScenePanel>
```

The `scrollUnits` prop of `ProgressManager` has no effect in per-panel mode (there is no global scroll allocation). Only `fn`, `autoAdvance`, and `animationTimeScale` remain meaningful. For multi-step demos (3+ scenes), relative `scrollUnits` values allocate the panel's scroll window proportionally between steps via the existing `SceneProgressMapper`.

### 3.4 Panel height constraint

**Animated ScenePanels must have `height >= 100vh`.** Panels shorter than the viewport have no scroll traversal window (`maxScroll <= 0`). They display the terminal pose (progress=1) at all times. Authors who want animation must declare a panel taller than the viewport.

The scroll window is: `panelHeight - viewportHeight`. For natural animation pacing, the scroll window should be 300-800px.

`height="calc(100vh + 400px)"` is the standard recommendation: constant 400px scroll window regardless of viewport size. `height="150vh"` gives a 50vh scroll window that scales with viewport.

`ScenePanel` should emit a `console.warn` in development if height resolves to less than `window.innerHeight` at mount time.

---

## 4. Layout Architecture

### 4.1 DOM structure

```
<body>
  <aside class="docs-sidebar" style="position: sticky; top: 0; height: 100vh;">
    {nav items}
  </aside>

  <main class="docs-main">        ← normal block flow; no overflow, height, or sticky
    {all sections in document order}
    {ScenePanels contain <canvas> elements directly in document flow}
  </main>
</body>
```

`docs-main` is a plain block container. `window.scrollY` is the scroll source for the entire page. There is no fixed-position canvas root — every canvas is a normal block element that scrolls with the page.

### 4.2 Section types

**1. ActHeader** — CSS-only full-width section separator. No canvas, no EngineProvider.

```tsx
<ActHeader id="act-getting-started" title="Getting Started" />
// renders: <section id="act-getting-started" class="act-header"><h2>...</h2></section>
```

**2. ScenePanel** — A fixed-height block element containing a real `<canvas>` in document flow. A `useCanvasContextLifecycle` hook wraps the panel and manages WebGL context acquisition via `WEBGL_lose_context` as the panel enters and exits the viewport (with `rootMargin: '200px'` lookahead so the engine is ready before the canvas is visible). The canvas renders 3D content directly into the panel's layout position.

```tsx
<ScenePanel id="scene-what-is-brewsite" height="calc(100vh + 400px)">
  <Scene id="base"> ... </Scene>
  <Scene id="arrived">
    <ProgressManager fn={DWELL_FN} />
    ...
  </Scene>
</ScenePanel>
```

**3. ProseBlock** — Documentation text in normal document flow.

```tsx
<ProseBlock id="installation-prose">
  <h1>Installation</h1>
  <CodeBlock language="bash" code="npm install @brewsite/core" />
  <Callout type="note">React 18+ and Three.js r158+ are required.</Callout>
</ProseBlock>
```

The `id` attribute is a real HTML `id` — anchor links (`#installation-prose`) work natively.

### 4.3 Panel height reference

| Use case | Recommended height | Scroll window |
|---|---|---|
| Act header with 3D visual | `100vh` | 0px — terminal pose only |
| Entry animation only | `calc(100vh + 200px)` | ~200px |
| Animation + dwell (standard) | `calc(100vh + 400px)` | ~400px |
| Multi-step demo (3–4 scenes) | `calc(100vh + 800px)` | ~800px |

With `DWELL_FN`, a 400px scroll window gives ~100px of animation (first 25%) and ~300px of reading dwell (remaining 75%).

---

## 5. WebGL Context Lifecycle

### 5.1 Browser context limits and the chosen solution

Chrome silently destroys the oldest WebGL context when a page exceeds ~16 active contexts. Firefox is similar. Safari is ~8. Destruction is silent — no JS error, the canvas goes black while the engine continues ticking.

The docs site (25 content scenes) would exceed both limits if all contexts were acquired simultaneously. The solution is per-panel context lifecycle management using the standard `WEBGL_lose_context` browser extension. Each panel acquires a context only while it is in or near the viewport, and explicitly releases the GPU slot when it exits. At any moment, active context count equals the number of panels within `rootMargin: '200px'` of the viewport — typically 1–2.

### 5.2 `useCanvasContextLifecycle` hook

Each `<ScenePanel>` uses a `useCanvasContextLifecycle` hook that wraps an `IntersectionObserver` around the panel's canvas:

```typescript
function useCanvasContextLifecycle(canvasRef: RefObject<HTMLCanvasElement>): void {
  const extRef = useRef<WEBGL_lose_context | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!initializedRef.current) {
            // First entry: EngineProvider acquires context normally via canvasRef.
            // Nothing to do here — engine mounts when context becomes available.
            initializedRef.current = true;
          } else {
            // Re-entry: context was explicitly lost; restore it.
            extRef.current?.restoreContext();
          }
        } else {
          if (initializedRef.current) {
            // Exit: acquire the extension (if not already held) and lose the context.
            const gl = canvas.getContext('webgl2');
            extRef.current = gl?.getExtension('WEBGL_lose_context') ?? null;
            extRef.current?.loseContext();
          }
        }
      },
      { rootMargin: '200px' }   // start restore 200px before the panel enters view
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);
}
```

**`rootMargin: '200px'`** means `restoreContext()` is called when the panel is 200px away from the viewport edge. By the time the canvas is visible, the engine has had time to re-initialize and the first frame is ready.

### 5.3 Coordination with the RAF loop and Three.js

`loseContext()` fires the `webglcontextlost` DOM event on the canvas element. `restoreContext()` fires `webglcontextrestored`. `RuntimeLoop` must listen for these events and pause/resume the RAF loop accordingly (see §7.1 for the full toolkit requirement).

Three.js `WebGLRenderer` (r158+) has partial internal handling for context loss — it stops rendering on `webglcontextlost` and attempts to re-upload all GPU resources on `webglcontextrestored`. BrewSite must coordinate above this: `RuntimeLoop` pauses the tick loop on `webglcontextlost` and resumes on `webglcontextrestored` after the renderer has reinitialized its WebGL state.

**Involuntary context loss** (GPU driver reset, tab backgrounding on iOS, memory pressure) can also trigger `webglcontextlost`. This is distinct from the explicit `loseContext()` call made by `useCanvasContextLifecycle`. The same `webglcontextlost` / `webglcontextrestored` listener on `RuntimeLoop` handles both cases correctly — the event source does not matter. The implementation plan should note that Three.js's resource re-upload on restore is not guaranteed to succeed on all driver/platform combinations, and a visible stall may occur on restoration after an involuntary loss.

### 5.4 Context count at runtime

With 25 panels on the page and a standard viewport showing 1–2 panels at a time:

- Active contexts: 1–2 (panels within `rootMargin: '200px'` of the viewport)
- Panels outside that window: GPU slot released via `loseContext()` — the browser reclaims the resource
- RAF loops running: 1–2 (only panels with live contexts, paused by `webglcontextlost` for the rest)

Safari's ~8-context limit is never approached regardless of page size.

---

## 6. Sidebar Navigation

### 6.1 What is removed

`SCENE_SCROLL_REGISTRY`, `SCENE_SCROLL_OFFSETS`, and `TOTAL_SCROLL_HEIGHT` are removed from `docs-nav.ts`. `DocsSidebar`'s use of `useSceneEngineState('docs')` for active scene detection is removed. The global `ScenePlayerRegistry` is not used by the new nav system.

### 6.2 Active section detection

Each `<ProseBlock id="...">` and `<ScenePanel id="...">` registers itself with `NavContext` on mount, providing its `id` and a `ref`. A single `IntersectionObserver` (configured with `root: null`, `rootMargin: '-20% 0px -60% 0px'`) monitors all registered elements. When an element crosses into the threshold zone, `NavContext` updates `activeSectionId`. The sidebar reads this and applies the active style.

No static registry. No pixel arithmetic. Handles viewport resize and dynamic content height automatically.

### 6.3 Jump-to-section

```typescript
type NavContextValue = {
  register: (id: string, ref: RefObject<HTMLElement>) => void;
  unregister: (id: string) => void;
  activeSectionId: string | null;
  /**
   * Scrolls to the given section.
   * @param id - The section id to scroll to.
   * @param progress - Optional [0..1] within-panel progress offset.
   *   When provided, calculates a target scrollY that places the panel
   *   at the given progress fraction of its scroll window.
   *   When omitted, scrolls to the panel top (progress=0).
   */
  scrollToSection: (id: string, progress?: number) => void;
};
```

For top-of-section navigation (most sidebar items), `scrollToSection(id)` calls `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`.

For within-panel navigation (multi-step demo sub-steps), `scrollToSection(id, progress)` calculates:

```typescript
const el = registrations[id]?.ref.current;
if (!el) return;
const panelTop = el.getBoundingClientRect().top + window.scrollY;
const maxScroll = el.offsetHeight - window.innerHeight;
const targetY = panelTop + clamp01(progress) * Math.max(0, maxScroll);
window.scrollTo({ top: targetY, behavior: 'smooth' });
```

This restores the within-panel navigation resolution of `SCENE_SCROLL_OFFSETS`, but computed at runtime from live element measurements rather than hardcoded at build time.

### 6.4 Deep-link support

`<ProseBlock id="installation">` renders a real HTML `id` attribute. Native anchor links (`/docs#installation`) work without JavaScript. `<ScenePanel id="scene-what-is-brewsite">` puts the `id` on the panel's outer div — the anchor scrolls to the panel top (progress=0).

---

## 7. Open Questions and Toolkit Requirements

**7.1 TOOLKIT REQUIREMENT: `RuntimeLoop.pause()` / `resume()` triggered by WebGL context events**

`RuntimeLoop` must respond to `webglcontextlost` and `webglcontextrestored` events on the canvas element:

- On `webglcontextlost`: call `RuntimeLoop.pause()` — suspend the RAF loop without destroying engine state. The Three.js `WebGLRenderer` is also invalid at this point and must not attempt further renders.
- On `webglcontextrestored`: call `RuntimeLoop.resume()` — restart the RAF loop. The Three.js `WebGLRenderer` must reinitialize its WebGL state before the first resumed tick.

`RuntimeLoop.pause()` and `RuntimeLoop.resume()` do not currently exist. Verified against `RuntimeLoop.ts`: the loop runs unconditionally until `stop()` is called — there is no pause/resume API.

Implementation approach:

1. Add `pause()` and `resume()` to `RuntimeLoop`. `pause()` cancels the pending `requestAnimationFrame` and sets a paused flag. `resume()` clears the flag and enqueues a new RAF.
2. In `ScenePanel` (or `useCanvasContextLifecycle`), register event listeners on the canvas element:

```typescript
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); // required to allow context restoration
  runtimeLoop.pause();
}, false);

canvas.addEventListener('webglcontextrestored', () => {
  // Three.js WebGLRenderer (r158+) automatically rebuilds its internal WebGL
  // state (programs, textures, geometries) on webglcontextrestored via its own
  // internal listener registered at construction time. No caller-facing API call
  // is required. BrewSite only needs to resume the tick loop.
  runtimeLoop.resume();
}, false);
```

These listeners handle both explicit `loseContext()` calls from `useCanvasContextLifecycle` and involuntary GPU-driver-initiated context loss events — the same code path serves both cases.

This is a new toolkit engineering task that must appear in the implementation plan. Without it, panels whose GPU context has been released continue running RAF callbacks against an invalid renderer.

**7.2 What happens to `DocPanel` and `DemoProgressProvider`?**

`DocPanel` is `position: absolute; inset: 0`. In the new design, prose is in `<ProseBlock>` — `DocPanel` has no role and should be deleted.

`DemoProgressProvider` derives `demoProgress` from `sceneProgress`. With 2-scene panels, the second scene's `sceneProgress` plays the same role. Likely removable; needs audit before deletion.

Unresolved: does any 3D content need to float over prose (sticky alongside text column)? If so, that section requires a hybrid approach outside the standard `<ScenePanel>` model.

**7.3 How does the new design handle act header visual transitions?**

**Decision: CSS-only.** Act headers are styled HTML `<div>` elements — no `<ScenePanel>`, no WebGL, no EngineProvider. The animated 3D transition is abandoned in favor of a pure CSS visual treatment. Implication: act headers have zero WebGL cost and do not participate in context lifecycle management. They are plain document elements from the browser's perspective.

**7.4 Migration strategy from the current sticky-canvas model**

A migration requires: authoring 2-scene pairs for each current single-scene content scene; moving `DocPanel` prose into `<ProseBlock>` elements; removing `SCENE_SCROLL_REGISTRY` / `SCENE_SCROLL_OFFSETS` / `TOTAL_SCROLL_HEIGHT`; replacing `DocsSidebar` engine polling with `NavContext`; implementing `useCanvasContextLifecycle` and wiring `ScenePanel` to it; implementing `RuntimeLoop.pause()`/`resume()` with WebGL context event handling.

**Decision: Big-bang.** The entire docs app will be rewritten at once. Implication: no compatibility shim is needed between the old sticky-canvas model and the new inline-canvas model. The old implementation is deleted and replaced in a single coordinated change.

**7.5 Does `EngineProvider` need a `scrollSource: 'self'` mode?**

**Decision: Core.** The per-panel viewport-relative scroll math will be a first-class `EngineProvider` capability in `@brewsite/core` — not app-level wiring in the docs app. A new `scrollSource={{ type: 'viewport-relative', containerRef }}` mode (or equivalent API) encapsulates the scroll geometry calculation inside the engine. Implication: this is a published API change to `@brewsite/core` and must appear in the implementation plan as a toolkit deliverable, not a docs-app deliverable. The `ScenePanel` scroll observer in the docs app is not the long-term home for this logic.

---

## Summary

The continuous natural-scroll redesign replaces the sticky-canvas + static pixel registry model with a standard web document where 3D canvas panels are inline block elements between prose sections. Each `<ScenePanel>` owns a real `<canvas>` in document flow — no fixed-position canvases, no CSS overlay positioning, no shared pool infrastructure. A `useCanvasContextLifecycle` hook manages WebGL context acquisition and release using the standard `WEBGL_lose_context` browser extension: `loseContext()` on exit from the viewport, `restoreContext()` on re-entry (with `rootMargin: '200px'` lookahead). At any moment only the 1–2 visible panels hold live WebGL contexts — Safari's ~8-context limit is never approached regardless of how many panels the page contains. Each animated panel requires a minimum of 2 scenes (compiler constraint: single-scene SceneTrack = 1 tick = terminal state only). Panel height must be >= 100vh for scroll animation to occur. Sidebar navigation is driven by `IntersectionObserver` and live element measurements; `scrollToSection(id, progress?)` restores within-panel navigation resolution. `RuntimeLoop.pause()`/`resume()` is an explicit new toolkit requirement, triggered by `webglcontextlost` / `webglcontextrestored` events on the canvas element — this method does not currently exist and must be implemented before the context lifecycle system functions correctly.
