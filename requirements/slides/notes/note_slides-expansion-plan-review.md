---
title: "Slides Expansion Change Plan — PM Review"
doc_type: note
owner: Toolkit Product
status: final
updated: 2026-03-20
---

# Slides Expansion Change Plan — PM Review

Structured review of `note_slides-expansion-change-plan.md` against the research note, current codebase, and toolkit architecture standards. Each finding is classified by severity.

---

## 1. Completeness

### 1.1 Research Note Coverage

**SHOULD FIX — Missing layout archetypes: Funnel and Roadmap**

The research note identifies Tier 3 layouts including Funnel and Roadmap (swimlane). The plan includes 20 layouts but omits both. Funnel is called out in the research note's Priority 2 graphical elements and Tier 3 layouts. Roadmap (swimlane) appears in the research note's Tier 3 as a distinct layout with "lanes + time axis" regions.

Both are deferrable to a later phase, but the plan should explicitly list them as non-goals or future work. Currently the plan is silent on them, which leaves ambiguity about whether they were intentionally omitted or forgotten.

**SHOULD FIX — Missing graphical components from Priority 2: Gauge/Meter, Cycle Diagram, Funnel Diagram**

The plan's 13 graphics components cover all Priority 1 items from the research but omit several Priority 2 items without acknowledging the gap. The plan should add a "Deferred Graphics" section listing Gauge/Meter, Cycle Diagram, Funnel Diagram, and Bubble/Circle Size Chart as explicit non-goals for Phase 1, with a note that they are candidates for a future phase.

**NICE TO HAVE — Morph/Magic Move transition omitted without comment**

The research note identifies Morph/Magic Move as a "high-impact" transition. The plan's expanded transition set (Phase 1E) does not include it. This is a reasonable omission — morph requires shared-key object interpolation, which is architecturally complex — but it should be called out explicitly as a non-goal with a brief rationale.

### 1.2 Existing Files Not Addressed

**BLOCKER — Plan does not address `plugin.ts` and `SlidesPluginOptions` changes**

The plan specifies that `DeckTheme` is deleted and `SlidePlayer` gains `slideTheme` and `template` props. However, `plugin.ts` currently accepts `SlidesPluginOptions` with a `theme: ResolvedDeckTheme` field. The `slidesPlugin()` call in `SlidePlayer.tsx` (line 468) passes `{ theme: resolvedTheme, navigation: ... }`.

When `DeckTheme` and `ResolvedDeckTheme` are deleted, `SlidesPluginOptions` must change. The plan does not mention `plugin.ts` in any file change table. This is a gap that will block implementation — the implementer will discover it mid-build when `SlidesPluginOptions` fails to compile.

**Action required:** Add `plugin.ts` to Phase 1A's file table. Specify that `SlidesPluginOptions.theme` changes from `ResolvedDeckTheme` to the new resolved slide configuration (likely the `--slide-*` CSS var map from `SlideTheme` + `SlideTemplate`). Alternatively, if `slidesPlugin()` no longer needs a theme argument (because visual tokens come from `SceneTheme` via core's `ThemeContext`), document that explicitly.

**BLOCKER — Plan does not address `SlideMetaWidget.ts` changes**

`SlideMetaWidget` currently receives state compiled from `SlideMetaDsl` props defined in `plugin.ts`. The plan's Phase 1A rewrites `deckCompiler.tsx` to "remove DeckTheme dependency" but does not address whether `SlideMetaWidget`, `SlideMetaState`, or the `SlideMetaDsl` props interface change. If the compilation flow changes (e.g., new per-slide state fields for `SlideTheme` timing tokens), the widget must be updated.

**Action required:** Audit `SlideMetaWidget.ts` and `SlideNavWidget.ts` and add them to the Phase 1A file table with explicit "no change needed" or a description of what changes.

**SHOULD FIX — Plan does not address `SlideTransitionWrapper.tsx`**

Phase 1E mentions rewriting `SlideTransitionWrapper.tsx` for CSS-based push/slide/zoom transitions. The file exists at `packages/slides/src/player/SlideTransitionWrapper.tsx`. The plan's Phase 1E file table correctly lists it. However, the plan does not describe how the transition wrapper integrates with the new `SlideTheme.timing.transitionDuration` token. Does the wrapper read `--slide-transition-duration` from CSS, or does it receive the value as a prop from `SlidePlayer`? This integration path must be specified.

**NICE TO HAVE — Plan does not address existing test files**

The slides package has test files: `computeSlideStartProgress.test.ts`, `themeFamily.test.ts`, `types.test.ts`, `themeCompiler.test.ts`, `deckCompiler.test.ts`, `layoutCompiler.test.ts`, `dsl.test.tsx`, `SlidePlayer.test.tsx`, `SlidePrintLayout.test.tsx`, `SlideProgressIndicator.test.tsx`, `SlideTransitionWrapper.test.tsx`. The plan does not mention which tests must be rewritten, which can be adapted, and which become dead code (e.g., `themeFamily.test.ts` should be deleted alongside `themeFamily.ts`). Adding a test impact note per phase would help the implementer plan their work.

**NICE TO HAVE — Plan does not address `PresenterView.tsx` or `SlidePrintLayout.tsx`**

These files exist in the player directory. The plan does not mention whether they need changes for the new theme system. `SlidePrintLayout.tsx` likely references `DeckTheme`/`ResolvedDeckTheme` and will fail to compile after deletion. `PresenterView.tsx` may also reference theme types.

### 1.3 SceneTheme CSS Variable Coverage

**SHOULD FIX — Missing `--brewsite-accent-color` in EngineOverlayHost injection**

The plan's Phase 0A specifies that `EngineOverlayHost` should inject `--brewsite-accent-color`. Currently, `EngineOverlayHost.tsx` does NOT inject this variable — the plan correctly identifies this as new. However, the current `SlidePlayer.tsx` (line 493-496) already manually injects `--brewsite-accent-color` into its container style as a workaround.

The plan should explicitly note that after Phase 0A lands, `SlidePlayer.tsx`'s manual `--brewsite-accent-color` injection becomes redundant and should be removed in Phase 1A. Without this note, the implementer may leave both in place, causing a double-injection that works but is confusing.

**SHOULD FIX — Graphics components will need `--brewsite-text-primary` and `--brewsite-text-secondary` but the plan maps them differently**

The plan says `--slide-color-heading` and `--slide-color-body` are being removed (they are DeckTheme tokens). Graphics components like `StatCard` and `Timeline` need text colors. The plan says "Visual styling (colors, fonts, shadows) via `--brewsite-*` CSS variables from core." But the current `EngineOverlayHost` only injects `--brewsite-text-primary` and `--brewsite-text-secondary`. The graphics components will need heading-vs-body color distinction.

Two paths: (a) graphics components use `--brewsite-text-primary` for headings and `--brewsite-text-secondary` for body text, or (b) Phase 0A adds `--brewsite-text-heading` as a separate variable. The plan should explicitly state which path is taken. The current `--brewsite-text-primary`/`--brewsite-text-secondary` pair (white/rgba(255,255,255,0.6) in dark mode) maps reasonably to heading/body, but naming is ambiguous.

**OBSERVATION — `--brewsite-font-size-*` scale is already injected by EngineOverlayHost**

The plan's `SlideTheme.typography` section defines heading/body/caption scale multipliers. These multiply against `--brewsite-font-size-*`. The current `EngineOverlayHost` already injects `--brewsite-font-size-heading`, `--brewsite-font-size-body`, etc. as `calc(1rem * N)`. The `SlideTheme` multiplier approach means slide components would need to compute `calc(var(--brewsite-font-size-heading) * var(--slide-heading-scale))`. This works but should be documented explicitly so component authors know the pattern.

### 1.4 Claude-Author Documentation

**SHOULD FIX — Missing doc file for `deck-authoring-patterns.md`**

The plan proposes 10 doc files in the `slides/` directory. The research note identifies several corporate deck patterns (Sequoia pitch deck, QBR, all-hands) as key use cases. A doc file showing how to compose these common deck structures from the layout and graphics primitives would be high-value for Claude retrieval. A query like "create a pitch deck" or "make a quarterly review presentation" would benefit from a section mapping deck type to recommended layout sequence.

**NICE TO HAVE — Missing doc file: `print-export.md`**

The plan lists `speaker-notes.md` covering print layout and slide snapshots. `SlidePrintLayout.tsx` and `captureSlideSnapshots()` are existing features that should be documented. The plan's `speaker-notes.md` outline lumps print with speaker notes, but these are different retrieval targets. A developer querying "print slides" should not have to retrieve speaker notes content alongside it. Consider splitting into separate files per the claude-author README's guidance on independent retrieval units.

---

## 2. Correctness

### 2.1 TypeScript Type Alignment

**BLOCKER — `SlideTheme.timing.entranceDuration` is a number but `--slide-entrance-duration` is injected as a unitless number**

The plan defines `entranceDuration: number` (default 0.3) representing a "progress window" (0-1 fraction). This is injected as the CSS variable `--slide-entrance-duration` with value `0.3`. CSS custom properties are strings — `0.3` is a valid string value. But components reading this via `var(--slide-entrance-duration)` in CSS cannot use a unitless number directly. It would only work if read via JavaScript (e.g., `getComputedStyle().getPropertyValue()`).

The animation hooks (`useEntrance`, `useStaggeredReveal`) read scene progress from `useSceneProgress()`, not from CSS variables. So these timing values are actually consumed by JavaScript hooks, not CSS. If that is the intent, the CSS variable injection is misleading — it suggests CSS-level consumption but the actual consumption is JavaScript-only.

**Action required:** Clarify the consumption model. If timing values are only consumed by hooks (JavaScript), they should be passed as props or context, not CSS variables. If they are consumed by CSS (e.g., `transition-duration: var(--slide-transition-duration)`), the values must have CSS units. `--slide-transition-duration: 300ms` is correct (has units). `--slide-entrance-duration: 0.3` is not usable in CSS `transition-duration`. The plan mixes these two models without distinguishing them.

**SHOULD FIX — `DeckSpec.theme` field removal not addressed**

`DeckSpec` (in `types.ts`, line 153-157) has a `theme: ResolvedDeckTheme` field. When `ResolvedDeckTheme` is deleted, `DeckSpec` must change. The plan mentions rewriting `types.ts` but does not specify what replaces `DeckSpec.theme`. It likely becomes unnecessary (colors/fonts come from SceneTheme, timing from SlideTheme), but the type must be updated. The `compileDeck()` function signature in `deckCompiler.tsx` accepts `ResolvedDeckTheme` — this call site needs updating too.

**OBSERVATION — `SlideSpec.restProgress` not mentioned**

`SlideSpec` has a `restProgress` field (line 139-147 of types.ts) that controls where navigation lands within a scene. This is an existing feature orthogonal to the expansion. The plan correctly does not mention it, but the implementer should be aware it exists and must be preserved in the rewritten types.

### 2.2 Three-Axis Model Cleanliness

**SHOULD FIX — Ambiguous token: `--slide-content-padding` vs `--brewsite-spacing-*`**

The plan adds `--brewsite-spacing-xs` through `--brewsite-spacing-xl` to core (Phase 0A) and also adds `--slide-content-padding: 48px` to `SlideTheme.density`. The current DeckTheme has `spacing.slide: '8%'` which maps to `--slide-padding`. The plan's `SlideTheme` replaces this with `--slide-content-padding: '48px'`.

The question: is content padding a "presentation density" concern (SlideTheme) or a "generic spacing" concern (SceneTheme)? The plan says SlideTheme, which is defensible — 48px padding is specific to slide presentations, not generic overlays. But then `--brewsite-spacing-*` tokens exist without a clear consumer in slides. The plan should clarify: do graphics components use `--brewsite-spacing-*` for internal spacing (gaps between stat card elements) and `--slide-content-padding` for region-level padding? If so, state that explicitly.

**OBSERVATION — `SlideTemplate.master.logo.asset` references brand assets by key**

The `SlideTemplate.master.logo.asset` field is typed as `'logo' | 'wordmark' | 'icon'`, referencing `SlideTemplate.brand.logo`, `.wordmark`, `.icon`. This is a clean indirection that avoids duplicating URLs. Good design.

### 2.3 CSS Variable Naming

**NICE TO HAVE — `--slide-*` namespace does not follow `--brewsite-*` convention**

Core uses `--brewsite-*` for all CSS variables. The plan introduces `--slide-*` as a separate namespace. This is an intentional design choice documented in the plan ("scoped to presentation-specific concerns that don't belong in core's `--brewsite-*` namespace"). The rationale is sound — `--slide-*` signals that these variables are slides-package-specific. However, for consistency across the toolkit, `--brewsite-slide-*` would be more conventional.

This is a low-stakes naming decision. Either works. But once shipped, the namespace is locked. Worth a brief deliberation before implementation.

### 2.4 "When to Use" Decision Sections

**OBSERVATION — Decision sections are well-targeted**

The proposed "when to use" sections in the docs plan cover the right decision points: ContentSlide vs TwoColumnSlide, BigNumberSlide vs MetricGridSlide, TimelineSlide vs ProcessSlide, BentoSlide vs DashboardSlide, FullBleedSlide vs ImageLeftSlide. These map to the actual decision points a developer (or Claude) will face when choosing a layout. The "SceneTheme vs SlideTheme Confusion" gotcha is particularly well-designed for retrieval.

---

## 3. Risks and Gaps

### 3.1 Implementation Risks

**BLOCKER — Deleting DeckTheme breaks the deckCompiler's content rendering pipeline**

The current `deckCompiler.tsx` hardcodes CSS variable references throughout `buildSceneElements()`. For example, line 97 uses `var(--slide-color-heading)`, line 98 uses `var(--slide-color-body)`, line 260 uses `var(--slide-padding, 8%)`, line 260 uses `var(--slide-gap, 1.5rem)`.

After the DeckTheme deletion, these `--slide-color-*` variables will no longer be injected (they were part of the old `ResolvedDeckTheme.cssVars`). The plan says colors come from `--brewsite-*` variables, but does not specify exactly which `--brewsite-*` variables replace which `--slide-*` variables in the hardcoded JSX inside `deckCompiler.tsx`.

**Action required:** Add a migration mapping table showing each `--slide-*` variable reference in `deckCompiler.tsx` and its replacement:

| Current reference in deckCompiler.tsx | Replacement |
|---|---|
| `var(--slide-color-heading)` | `var(--brewsite-text-primary)` |
| `var(--slide-color-body)` | `var(--brewsite-text-secondary)` |
| `var(--slide-color-surface)` | `var(--brewsite-surface-base)` or `var(--brewsite-surface-elevated)` |
| `var(--slide-color-muted)` | `var(--brewsite-text-muted)` |
| `var(--slide-padding, 8%)` | `var(--slide-content-padding)` |
| `var(--slide-gap, 1.5rem)` | `var(--slide-content-gap)` |
| `var(--slide-border-radius)` | `var(--brewsite-radius-md)` |
| `var(--slide-bg-gradient)` | Removed (gradient from SceneTheme.background.fill) |
| `var(--slide-font-body)` | `var(--brewsite-font-family)` (already used) |

The `dsl.tsx` text primitives (`Heading`, `Body`, `BulletList`, `NumberedList`) also reference `--slide-color-heading`, `--slide-color-body`, and `--brewsite-accent-color`. These must be updated too.

**SHOULD FIX — Dependency ordering: Phase 1B-1E "can be implemented in parallel" but 1C depends on 1A's CSS variables**

The plan says Phase 1B-1E can be implemented in parallel after 1A. This is mostly true, but Phase 1C (graphics components) depends on both `--brewsite-*` variables (from Phase 0A) AND `--slide-*` variables (from Phase 1A). If 1C starts before 1A's `--slide-*` variables are finalized, component authors will be guessing at variable names.

**Recommendation:** Explicitly note that 1C should begin after 1A's `SlideTheme` type and CSS variable list are finalized (the type definition, not the full implementation). The component CSS can reference variables before they are injected — it just needs the names to be stable.

**SHOULD FIX — `SlidePlayer.tsx` rewrite complexity is underspecified**

`SlidePlayer.tsx` is the most complex file in the package (612 lines). The plan says "Replace `theme` prop (was DeckTheme) with `slideTheme` prop (SlideTheme) and `template` prop (SlideTemplate)." This understates the work. The file currently:
1. Compiles the DeckTheme into a ResolvedDeckTheme (line 413)
2. Passes the resolved theme's sceneTheme to `<SceneEngine sceneTheme={...}>` (line 540)
3. Passes the resolved theme to `slidesPlugin({ theme: resolvedTheme })` (line 468)
4. Injects `--slide-*` CSS vars from `resolvedTheme.cssVars` (line 493-496)
5. Uses `resolvedTheme.background.color` for fullscreen background (line 503)

Each of these integration points changes in the new architecture. The plan should enumerate them to prevent the implementer from missing one.

### 3.2 Missing Test Plan Items

**SHOULD FIX — No test plan for graphics components**

Phase 1C introduces 13 React components but has no test plan section. Graphics components need:
- Snapshot tests verifying rendered HTML structure
- Tests verifying CSS variable consumption (correct `var()` references in style attributes)
- Tests verifying `progress` prop drives entrance animation correctly
- Tests verifying `className` and `style` escape hatches work

**SHOULD FIX — No test plan for animation hooks**

Phase 1D introduces 4 hooks but has no test plan section. Hooks need:
- Unit tests for `useCountUp` verifying correct value at various progress points
- Unit tests for `useStaggeredReveal` verifying visibility/opacity at edge cases (0 items, 1 item, progress=0, progress=1)
- Unit tests for `useProgressWindow` verifying clamping and easing
- Tests verifying hooks read from `useSceneProgress()` correctly

### 3.3 Graphical Components Complexity Assessment

**SHOULD FIX — `ComparisonTable` may be too complex for Phase 1**

`ComparisonTable` accepts `headers: string[]`, `rows: Array<{ feature: string; values: Array<boolean | string | number> }>`, and `highlightColumn?: number`. A feature comparison table with checkmark/cross rendering, column highlighting, and progress-driven entrance animation is a significant component. Consider whether this belongs in Phase 1 or should be deferred to Phase 2.

The risk is that `ComparisonTable` will accumulate feature requests (column sorting, cell tooltips, nested headers) that are better addressed once the simpler graphics components have proven the pattern.

**NICE TO HAVE — `IconGrid` depends on an icon system not specified**

`IconGrid` is listed as a graphics component but the plan does not specify how icons are provided. The `StatCard` interface shows `icon?: ReactNode`, allowing consumers to pass any React element. `IconGrid` likely follows the same pattern, but this should be stated. If `IconGrid` is expected to accept icon names (e.g., from heroicons via `@brewsite/diagram`'s icon registry), that creates a cross-package dependency that must be documented.

---

## 4. API Design Quality

### 4.1 SlideTheme Token Names

**OBSERVATION — Token names are clear and unambiguous**

`SlideTheme.timing.transitionDuration`, `.timing.entranceDuration`, `.density.contentPadding`, `.density.contentGap`, `.typography.headingScale`, `.components.cardBorderWidth` — all read well and express intent without ambiguity. The four-group structure (timing, density, typography, components) is a clean decomposition.

**NICE TO HAVE — `density.titleHeight` and `density.gutter` use NVS fractions; all other density tokens use CSS strings**

`titleHeight: number` (default 0.18) and `gutter: number` (default 0.02) are NVS-normalized fractions, while `contentPadding: string` (default '48px') and `contentGap: string` (default '16px') are CSS length strings. Mixing units within the same group is a minor ergonomic concern. Developers may not immediately understand that `titleHeight: 0.18` means "18% of viewport" while `contentPadding: '48px'` is a CSS absolute length.

Consider adding JSDoc comments to these fields explicitly noting the unit system, or renaming to `titleHeightNvs` / `gutterNvs` to signal the difference.

### 4.2 Graphical Component Props

**SHOULD FIX — `ComparisonTable.values` type is too loose**

`values: Array<boolean | string | number>` is a union that does not express the rendering intent. A `boolean` renders as a checkmark/cross, a `string` renders as text, a `number` renders as a number. This is implicit behavior driven by runtime type checking. Consider a discriminated union or a dedicated cell type:

```typescript
type ComparisonCellValue =
  | { kind: 'check'; value: boolean }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number };
```

This is more verbose but eliminates ambiguity (what does `values: [true, "partial", 3]` render?). The simpler `boolean | string | number` approach works but is an API regret risk — adding new cell types later (e.g., icon, rating) requires widening the union, which changes the runtime type-checking logic.

**OBSERVATION — `progress` prop on all graphics components is a good design**

Making `progress` optional (defaults to undefined = no animation) is the right approach. Components that receive no `progress` render fully visible immediately. Components that receive `progress` animate. This is composable and does not force animation on consumers who do not want it.

### 4.3 Animation Hook Signatures

**OBSERVATION — Hook signatures are ergonomic**

`useCountUp(target, options?)` is the right call — target is always required, options are always optional. The options object pattern with sensible defaults makes each hook zero-config for the common case.

**SHOULD FIX — `useStaggeredReveal` returns `{ visible, opacity, style }` but `style` overlaps with `opacity`**

The return type includes both `opacity: number` and `style: CSSProperties` (which presumably includes `opacity` among other properties). If `style` already contains `opacity`, returning `opacity` separately is redundant. If `style` does NOT contain `opacity`, then the consumer must manually apply both, which is error-prone.

**Recommendation:** Return only `style: CSSProperties` (which includes opacity, transform, etc.) and `visible: boolean`. The `visible` flag is useful for conditional rendering (`visible && <Item />`), but `opacity` as a separate return value adds confusion.

### 4.4 Layout Component Naming

**OBSERVATION — `*Slide` suffix is the right choice**

Renaming from `TitleLayout` to `TitleSlide`, `TitleBodyLayout` to `ContentSlide`, etc. is correct. These are slide types, not generic layout primitives. The `*Slide` suffix signals that they are specific to the slides package and compile to complete slide regions, not reusable layout utilities. This naming also aligns with Slidev's conventions.

**NICE TO HAVE — `ImageLeftSlide` / `ImageRightSlide` could be a single `ImageSlide` with a `position` prop**

Two separate components for left/right image placement doubles the API surface for a single concept. An alternative:

```typescript
<ImageSlide imagePosition="left" image={...} title="..." />
```

This reduces the layout count from 20 to 19 and the export surface by one component. The tradeoff is slightly less scannable in autocomplete (one component with a prop vs two distinct components). Either is defensible, but the single-component approach is more extensible (adding `imagePosition: 'top'` later does not require `ImageTopSlide`).

---

## 5. Doc Quality

### 5.1 Claude-Author README Compliance

**OBSERVATION — Section outlines follow the README rules correctly**

The proposed doc sections use specific headings (not "Overview" or "Usage"), lead with code examples, use exact API names (`StatCard`, `useCountUp`, `ContentSlide`), and include real TypeScript. The "When to Use X vs Y" pattern is correctly applied across layout choices. The section templates shown in the plan follow the chunking model (each `##` is self-contained).

**SHOULD FIX — `overview.md` "Package Exports" section risks being too large for a single retrieval chunk**

The plan says "Tables for: DSL Components, Layout Components, Graphics Components, Animation Hooks, Theme Presets, Player Components, Types." This is potentially 7 tables in one `##` section, which could exceed the 800-token guidance from the README. Consider splitting into `## DSL and Layout Exports`, `## Graphics Component Exports`, `## Animation and Theme Exports` — three retrieval units instead of one.

### 5.2 Gotcha Entries

**OBSERVATION — Gotcha entries are realistic failure modes**

All four proposed gotchas target actual failure modes:
1. "Slide Layout Children Are Not React Renders" — this will absolutely occur. Developers will try wrapping layout children in `<div>` with custom positioning.
2. "SceneTheme vs SlideTheme Confusion" — this is the primary API confusion risk of the three-axis model.
3. "Using sceneDsl Without Camera or Lighting" — this is an existing gotcha that will become more frequent as more developers use slides.
4. "Entrance Animation Without scrollUnits" — this is a subtle timing issue that will be hard to debug without the gotcha.

**SHOULD FIX — Missing gotcha: "Graphics Components Must Be Inside Layout Children"**

A developer will try to place a `<StatCard>` directly inside `<Slide>` without a layout component, expecting it to render. Since layout components are compiled (not rendered), a `<StatCard>` that is not inside a layout's children region will not appear. This is a predictable failure mode that should be documented.

**SHOULD FIX — Missing gotcha: "SlideTheme Timing Values Are Progress Fractions, Not Milliseconds"**

`entranceDuration: 0.3` means "30% of the scene's progress window," not "300ms." A developer accustomed to CSS animation durations will set `entranceDuration: 300` expecting milliseconds and get broken animations. This is a gotcha that the three-axis model introduces.

### 5.3 Decision Coverage

**SHOULD FIX — Missing "When to Use" section: `StatCard` vs inline HTML**

Developers will ask: "Should I use `<StatCard>` or just write my own `<div>` with styled text?" The answer is that `StatCard` consumes theme tokens, handles progress-driven count-up animation, and adapts to `SlideTheme` density settings — building it yourself means reimplementing all of that. This decision point should be in `graphics.md`.

**NICE TO HAVE — Missing "When to Use" section: animation hooks vs `progress` prop**

Graphics components accept a `progress` prop for built-in entrance animation. Animation hooks (`useEntrance`, `useStaggeredReveal`) provide standalone animation utilities. When should a developer use the component's `progress` prop vs calling hooks directly? The likely answer is: use `progress` for simple entrance effects on individual components, use hooks when composing custom animations across multiple components or when building custom graphics. This should be documented.

---

## 6. Summary of Findings by Severity

### BLOCKERS (3) — Must fix before implementation starts

1. **`plugin.ts` and `SlidesPluginOptions` not addressed** — Deleting `ResolvedDeckTheme` will break the plugin factory. The plan must specify what replaces it.
2. **`SlideMetaWidget.ts` changes not addressed** — The widget's integration with the compilation pipeline needs explicit treatment.
3. **`--slide-color-*` variable removal creates broken references in `deckCompiler.tsx` and `dsl.tsx`** — A migration mapping table is required showing exactly which `--brewsite-*` variable replaces each deleted `--slide-*` variable in the hardcoded JSX.

### SHOULD FIX (14) — Important improvements, fix before finalizing the plan

1. Missing layout archetypes (Funnel, Roadmap) should be listed as explicit non-goals.
2. Missing graphical components (Gauge, Cycle, Funnel diagram) should be listed as deferred.
3. After Phase 0A, SlidePlayer's manual `--brewsite-accent-color` injection is redundant — note the cleanup.
4. Heading vs body text color variable mapping needs explicit specification.
5. `--slide-content-padding` vs `--brewsite-spacing-*` consumption model needs clarification.
6. Phase 1C depends on 1A's CSS variable names being finalized — document this ordering constraint.
7. `SlidePlayer.tsx` rewrite has five integration points that should be enumerated.
8. No test plan for graphics components (Phase 1C).
9. No test plan for animation hooks (Phase 1D).
10. `ComparisonTable` complexity — consider deferring to Phase 2.
11. `useStaggeredReveal` return type has redundant `opacity` alongside `style`.
12. `overview.md` Package Exports section may be too large for one retrieval chunk.
13. Missing gotcha: graphics components must be inside layout children.
14. Missing gotcha: SlideTheme timing values are progress fractions, not milliseconds.

### NICE TO HAVE (7) — Can be addressed during implementation

1. Morph/Magic Move transition should be listed as an explicit non-goal.
2. Existing test files should be listed with disposition (rewrite/delete/keep).
3. `PresenterView.tsx` and `SlidePrintLayout.tsx` should be checked for DeckTheme references.
4. `--slide-*` vs `--brewsite-slide-*` namespace decision should be deliberated.
5. `IconGrid` icon source pattern should be specified.
6. `ImageLeftSlide`/`ImageRightSlide` could be a single `ImageSlide` with a position prop.
7. Missing "when to use" section: animation hooks vs progress prop.

### OBSERVATIONS (6) — No action needed

1. `ComparisonTable.values` type is loose but workable for v1.
2. `progress` prop on all graphics components is well-designed.
3. Hook signatures are ergonomic.
4. `*Slide` naming convention is correct.
5. Decision sections in docs target the right questions.
6. Gotcha entries are realistic failure modes.

---

## 7. Overall Assessment

The plan is architecturally sound. The three-axis customization model (SceneTheme / SlideTheme / SlideTemplate) is the right design — it cleanly separates visual tokens, presentation behavior, and corporate branding into independent concerns. Killing DeckTheme and unifying on SceneTheme for colors/fonts is the correct call and eliminates a real maintenance burden.

The primary risk is incomplete specification of the DeckTheme removal's downstream impact. The plan correctly identifies the new types and the high-level strategy, but does not trace all the compilation and rendering code paths that currently depend on `DeckTheme`, `ResolvedDeckTheme`, and the `--slide-color-*` / `--slide-padding` / `--slide-gap` CSS variables. An implementer starting this work will hit compile errors in `plugin.ts`, `SlideMetaWidget.ts`, `deckCompiler.tsx`, `dsl.tsx`, `SlidePrintLayout.tsx`, and `PresenterView.tsx` that are not accounted for in the plan's file tables.

Fix the three blockers, address the high-priority should-fix items, and this plan is ready for implementation.
