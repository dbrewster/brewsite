---
title: "Corporate Slide Landscape Research"
doc_type: note
owner: Toolkit Product
status: final
updated: 2026-03-20
---

# Corporate Slide Landscape Research

Research conducted to inform the expansion of `@brewsite/slides` from a basic five-layout slide system to a comprehensive corporate presentation toolkit. This note catalogs industry patterns, layout archetypes, graphical elements, template/theme system designs, animation conventions, and modern trends.

---

## 1. Corporate Slide Deck Formats

### Consulting (McKinsey / BCG / Bain)

Every McKinsey slide follows a rigid three-part structure:

1. **Action Title** — A complete sentence stating the key takeaway (not a topic label). McKinsey calls these "leads" or "headlines."
2. **Slide Body** — Charts, tables, text, or infographics supporting the action title.
3. **Footer** — Source notes and page numbering.

The overall deck follows the **Pyramid Principle** (Barbara Minto): lead with the conclusion, then present supporting arguments grouped logically (MECE). Presentations use an **SCR framework** (Situation-Complication-Resolution) for narrative flow. BCG leans more graphics-heavy — relying almost exclusively on charts, graphs, tables, and images.

**Key slide types**: Executive Summary / "At A Glance" (the single most time-intensive slide), body argument slides, data exhibit slides, and recommendation slides.

### Big Tech (Apple, Google, Microsoft)

Apple and Google share a **narrative-first, minimalist** philosophy. Apple's Keynotes are products of rigorous design strategy, storytelling, and iteration. Google's keynotes are "stylistically minimal" with retro-influenced elements. Both use conservative color palettes with strategic color accents. Guiding principle: **don't stand in the way of your own storytelling.** Microsoft tends toward more information-dense slides with structured layouts.

### Investor / Fundraising Decks

The **Sequoia Capital Pitch Deck Template** is the global standard for startup fundraising (10-12 slides):

| # | Slide | Purpose |
|---|---|---|
| 1 | Title / Cover | Brand + tagline |
| 2 | Company Purpose | One-line mission |
| 3 | Problem | Pain point |
| 4 | Solution | How you solve it |
| 5 | Why Now | Market timing |
| 6 | Market Size | TAM / SAM / SOM |
| 7 | Competition | Landscape |
| 8 | Product | Demo / screenshots |
| 9 | Business Model | Revenue mechanics |
| 10 | Team | Key people |
| 11 | Financials | Traction / projections |
| 12 | Ask | Funding amount + use |

### SaaS Product Launch Decks

Defining characteristics: **simplicity and clarity**. Typically 10-20 slides covering: Cover, Problem, Solution, Business Model, Market Analysis, Competitive Analysis, Marketing/Sales Strategy, Financial Projections, Team, and Funding Ask.

### Quarterly Business Review (QBR)

Typically 30-40 slides structured around:
- Executive Summary (quarterly highlights, key results, priorities)
- Key Metrics & Performance (dashboards, KPIs, charts)
- Strategic Goals & Achievements
- Future Roadmap (next steps, upcoming objectives)
- Action Items

### All-Hands / Town Hall

- Company mission/values reinforcement
- Quarterly results and key metrics
- Team highlights and wins
- Product updates and demos
- Q&A / open forum
- Heavy use of big-number stat cards and timeline/roadmap visuals

---

## 2. Layout Archetype Taxonomy

Based on PowerPoint's built-in system, Beautiful.ai's 300+ smart slides, Slidev's layouts, and consulting patterns:

### Tier 1: Essential (every deck needs these)

| Layout | Description | Regions |
|---|---|---|
| **Title / Cover** | Full-viewport title with optional subtitle, logo, tagline | 1 centered block |
| **Section Divider** | Large text or number + title for chapter breaks | 1 centered block |
| **Title + Body** | Title bar + content area (text, bullets, numbered lists) | Title region + body region |
| **Two-Column** | Optional title + two equal columns (text/text, text/image, text/chart) | 2-3 regions |
| **Image + Text** | Large image on one side, text content on the other | 2 regions (60/40 or 50/50 split) |
| **Full-Bleed Image** | Full background image with optional text overlay | 1 overlay region |
| **Blank / Custom** | No predefined placeholders | Author-defined |

### Tier 2: High-Value Corporate (used in most decks)

| Layout | Description | Regions |
|---|---|---|
| **Big Number / KPI** | Hero stat with context label and optional trend indicator | 1-4 stat cards |
| **Metric Grid** | 3-4 KPI cards in a row with icons/labels | Grid of stat regions |
| **Comparison** | Side-by-side with labeled headers, before/after, vs. layout | 2 equal columns + header |
| **Timeline** | Horizontal or vertical with milestone markers | Linear flow + markers |
| **Process / Steps** | Sequential numbered steps with icons or descriptions | 3-6 step regions |
| **Quote / Testimonial** | Large quote with attribution and optional photo/logo | Quote block + attribution |
| **Agenda / TOC** | Numbered or bulleted topic list, optionally with icons | Stacked list |
| **Closing / CTA** | Contact info, next steps, call to action | Center block + footer |

### Tier 3: Specialized (used in specific deck types)

| Layout | Description | Regions |
|---|---|---|
| **Team / People** | Photo grid with names/titles, or featured individual spotlight | Grid or hero + sidebar |
| **Matrix / Quadrant** | 2x2 grid with labeled axes for categorization | 4 quadrant cells + axis labels |
| **Funnel** | Vertically or horizontally tapering stages | 3-5 narrowing regions |
| **Pyramid** | Hierarchical layers (3-5 tiers) | Stacked trapezoids |
| **Bento Grid** | Modular asymmetric card boxes (Apple-inspired) | Variable-size cards |
| **Dashboard** | Multi-chart layout with 2-4 data widgets | Grid of chart regions |
| **Roadmap** | Swim-lane or timeline-based project/product roadmap | Lanes + time axis |
| **Feature Matrix** | Table-style comparison with checkmarks/crosses | Grid + headers |

### Key Insight: Layout = Region Placement + Content Constraints

Every layout is fundamentally a **region placement strategy** with content-type constraints on each region. The current `@brewsite/slides` architecture (NVS-normalized regions compiled from layout types) is the right foundation — it just needs more layout definitions and richer region semantics.

---

## 3. Common Graphical Elements

These are the building-block graphics that appear across every corporate deck format. They are distinct from full chart types (bar, line, pie) which `@brewsite/charts` already handles.

### Priority 1: Appears in nearly every corporate deck

| Element | Description | Use Cases |
|---|---|---|
| **Stat Card** | Large number with label, optional trend arrow, optional icon | KPI slides, dashboards, executive summaries |
| **Timeline** | Horizontal or vertical with milestone markers and labels | History, roadmap, project plan, product evolution |
| **Process Steps** | Numbered sequential steps with icons and descriptions | Workflows, onboarding, implementation plans |
| **Icon Grid** | Grid of icons with labels (3x2, 4x2, 3x3) | Feature lists, capability grids, value propositions |
| **Comparison Table** | Feature matrix with checkmarks, crosses, or values | Competitive analysis, plan comparison, before/after |
| **Progress Bar / Ring** | Linear or circular progress indicator with percentage | Goal tracking, completion status, quarterly progress |
| **Callout Box** | Highlighted text container with accent border or background | Key takeaways, warnings, definitions |

### Priority 2: Very common in specific deck types

| Element | Description | Use Cases |
|---|---|---|
| **Funnel Diagram** | Tapering stages showing conversion/narrowing | Sales pipeline, marketing conversion, hiring |
| **Bubble / Circle Size Chart** | Circles of varying size showing relative magnitude | Market size, budget allocation, team size |
| **2x2 Matrix** | Quadrant chart with labeled axes | Strategy positioning, prioritization, Gartner-style |
| **Cycle Diagram** | Circular arrows showing repeating process | Development cycles, feedback loops |
| **Gauge / Meter** | Semicircular meter with needle/fill showing against target | Performance dashboards, health scores |
| **Big Number Counter** | Animated counting number with context | Revenue, users, growth percentage |
| **Quote Block** | Styled blockquote with attribution and optional photo | Testimonials, executive quotes |
| **Badge / Tag** | Small labeled indicators showing status | Feature status, priority, category |

### Priority 3: Specialized but high-impact

| Element | Description | Use Cases |
|---|---|---|
| **Pyramid** | Hierarchical layers (3-5 tiers) | Maslow's hierarchy, strategy pyramids |
| **Venn Diagram** | 2-3 overlapping circles | Relationship visualization, convergence |
| **Org Chart** | Hierarchical tree structure | Team structure, reporting lines |
| **Swimlane Roadmap** | Multi-track timeline with parallel streams | Product roadmap, project plan |
| **Before/After Split** | Side-by-side or split-screen showing change | Transformations, results |
| **Connector Flow** | Boxes connected by arrows showing data/process flow | Architecture, data pipelines |

### Key Insight: React Components, Not 3D Elements

Most of these graphical elements are **2D/HTML constructs** rendered in the HUD/overlay layer, not Three.js 3D objects. They should be React components that consume theme tokens (colors, fonts, spacing) and accept structured data props. The 3D canvas remains available for `@brewsite/diagram`, `@brewsite/charts`, and `@brewsite/model` content — but the slide graphics library is fundamentally a **themed React component library**.

---

## 4. Template / Theme System Analysis

### PowerPoint: The Gold Standard for Corporate Templates

Three-tier hierarchy:
1. **Theme** — Colors (12-slot palette), fonts (heading + body), effects (shadows, reflections)
2. **Slide Master** — Global elements (logo placement, background, footer text) that appear on all slides using that master
3. **Slide Layouts** — Specific placeholder arrangements (Title, Content, Two-Column, etc.) under each master

Key properties:
- Multiple themes/masters can coexist in one deck
- Changes to a master propagate to all slides based on that master
- Layouts define placeholder positions, sizes, and content types
- Corporations distribute branded `.potx` template files that lock down masters

### Slidev: Developer-Friendly Theme Packages

- Themes are **npm packages** (e.g., `slidev-theme-seriph`)
- Applied with one line of YAML frontmatter: `theme: seriph`
- Layouts are Vue components wrapping slide content
- Built-in layouts: `center`, `cover`, `default`, `end`, `fact`, `full`, `image-left`, `image-right`, `image`, `intro`, `none`, `quote`, `section`, `statement`, `two-cols`, `two-cols-header`
- Themes can override/extend any layout, add new components, and provide custom CSS

### Reveal.js: CSS-Based Theming

- 11 built-in themes, each a CSS stylesheet
- Swapped by changing one import
- Custom themes extend a base theme's SCSS/CSS
- Layout helpers: `r-stack`, `r-stretch`, `r-fit-text`
- Fragments (step-through reveals) are attribute-based, not component-based

### Beautiful.ai: Smart Slide Auto-Layout

- 300+ intelligent slide types that auto-adapt as content changes
- Spacing, alignment, typography, and animations adjust in real time
- No manual formatting — the design engine enforces constraints
- Closest to what "templates" should feel like in a modern tool

### Canva: Brand Kit Integration

- Brand kit system: upload logos, define color palette, select fonts
- Magic Design: AI generates on-brand decks from text prompts
- Templates are flat (no master/layout hierarchy), each slide independently editable

### Key Insight: The Right Model for @brewsite/slides

The ideal template system combines:
1. **Slidev's developer ergonomics** — Templates as importable packages with TypeScript types
2. **PowerPoint's hierarchical theming** — Corporate brand tokens (colors, fonts, logos, spacing) propagate to all layouts and elements
3. **Beautiful.ai's constraint-driven layout** — Layouts that adapt intelligently as content changes

For `@brewsite/slides`, this translates to:

```
CorporateTemplate (npm package or local config)
  ├── DeckTheme (colors, fonts, spacing, effects)
  ├── BrandAssets (logo, wordmark, icon, backgrounds)
  ├── LayoutOverrides (custom region positions per layout)
  ├── SlideGraphics (preconfigured graphical element variants)
  └── TransitionDefaults (preferred transitions and timings)
```

---

## 5. Animation Patterns in Corporate Decks

### Slide Transitions (between slides)

| Transition | Corporate Use | Notes |
|---|---|---|
| **Cut** (none) | Most professional | Zero distraction, McKinsey default |
| **Fade / Dissolve** | Very common | Smooth opacity crossfade |
| **Push / Slide** | Common | One slide pushes another off-screen |
| **Morph / Magic Move** | High-impact | Object interpolation between slides (PowerPoint Morph, Keynote Magic Move) |
| **Zoom** | Specialized | Drill-down into content regions |

### Build Animations (within a slide)

| Animation | Use | Notes |
|---|---|---|
| **Appear** | Universal | Instant visibility toggle |
| **Fade In** | Professional standard | Gradual opacity |
| **Fly In** | Common | Slide from edge (directional) |
| **Grow / Scale** | Emphasis | Scale up from small |
| **Staggered Reveal** | Lists/grids | Items appear one at a time with consistent delay |
| **Wipe** | Charts/images | Progressive directional reveal |

### Data-Specific Animations

| Animation | Use | Notes |
|---|---|---|
| **Number Counting** | Stat cards | Count up from 0 to final value |
| **Bar Growth** | Bar charts | Bars grow from zero to value |
| **Line Drawing** | Line charts | Line draws progressively |
| **Donut Fill** | Pie/donut charts | Sections animate in sequence |
| **Progress Fill** | Progress bars/rings | Fill animates to target |

### Best Practices (Industry Consensus)

- **Subtlety wins**: Fade, Appear, and Fly-in are the professional standards
- **Consistency**: Same animation type across all slides for similar elements
- **Moderation**: Animate roughly one-third of slides, not everything
- **Fast timing**: Shortest reasonable duration
- **Purpose-driven**: Every animation supports comprehension, not decoration

### Key Insight: @brewsite/slides Animation Model

The current `sceneProgress`-driven animated bullet system is a solid foundation. Expanding it to cover:
- Staggered reveal for any list/grid (not just bullets)
- Number counting for stat cards
- Progress fill for indicators
- Region-level entrance animations (fade/fly per region)

...would cover 90% of corporate animation needs. The existing `SlideTransition` enum (`dissolve`, `cut`, etc.) handles slide-to-slide transitions.

---

## 6. Modern Trends (2025-2026)

### AI-Powered Creation
- **Gamma.app**: Card-based document format (not traditional slides). Nested cards, live embeds, responsive layouts, single-click themes. Cuts creation time ~70%.
- **Beautiful.ai**: Smart Slides auto-adapt. 300+ slide types with real-time adjustment.
- **Tome**: Storytelling emphasis with embedded live/interactive content.
- Over 72% of business professionals now use AI for presentations (2025 survey).

### Bento Grid Layouts
Inspired by Apple, the **Bento Grid** divides slides into modular, asymmetric rectangular boxes. A 2025 study found users completed information-finding tasks **23% faster** on modularly organized layouts vs. traditional linear layouts. Evolution includes animated Bento grids, AI-generated layouts, and 3D Bento with depth.

### Glassmorphism 2.0
Frosted-glass effects with soft blurred color gradients. Combines depth, soft shadows, micro-interactions, and textures. Natural fit for 3D rendering — `@brewsite/slides` has a unique advantage here.

### Dark Mode as Default
Moved from trend to expectation. Reduces eye strain, provides premium aesthetic. Works particularly well for data-heavy presentations. Already supported in `@brewsite/slides` via `DeckTheme.colorMode`.

### Interactive / Web-Native
- Clickable content, real-time polls, branching routes
- Embedded live data, videos, interactive components
- Link-based sharing replacing file-based distribution
- `@brewsite/slides` is inherently web-native — this is a differentiator

### Purpose-Driven Motion
Animation philosophy has matured: guide attention and explain transitions, not entertain. Animated data (bars rising, donuts filling section-by-section) turns raw data into visual narrative.

### Data Storytelling
Clean visuals highlighting a single critical insight rather than showing entire spreadsheets. Trend toward "one insight per slide" with supporting detail available on drill-down.

---

## 7. Competitive Gap Analysis: @brewsite/slides Today vs. Market

| Capability | Current State | Gap |
|---|---|---|
| **Layouts** | 5 basic layouts (title, title-body, two-column, full-bleed, blank) | Missing ~15 high-value archetypes |
| **Graphical Elements** | None (text primitives only) | No stat cards, timelines, process steps, icon grids, etc. |
| **Template System** | DeckTheme (colors, fonts, spacing) + 7 named theme families | No brand asset system, no logo/watermark placement, no layout overrides |
| **Build Animations** | Animated bullet reveal via sceneProgress | No staggered grid, no counting numbers, no region entrance |
| **Slide Transitions** | dissolve, cut | Missing push, morph, zoom |
| **Data Integration** | sceneDsl prop for 3D charts/diagrams | No native 2D chart components, no data animation |
| **Corporate Branding** | CSS variables for colors/fonts | No logo system, no footer templates, no brand kit concept |
| **Presenter Tools** | Speaker notes + presenter view | No timer, no audience view, no remote control |
| **Content Density** | Single-purpose layouts | No dashboard/multi-widget layouts, no bento grid |
| **Export** | Print layout with snapshots | No PDF export, no PPTX export |

### Unique Advantages of @brewsite/slides

1. **3D Canvas Integration** — No competitor offers native Three.js integration with diagrams, models, and charts inside slides
2. **Web-Native Architecture** — Built for the browser, responsive, shareable via URL
3. **Compiler Pipeline** — Declarative DSL with pre-baked SceneTrack enables performant playback
4. **Theme-to-3D Bridge** — DeckTheme flows into SceneTheme, so 3D elements match slide styling
5. **Developer Ergonomics** — TypeScript-first, component-based authoring

---

## 8. Recommendations Summary

### Phase 1: Layout & Graphics Library (React Components)
- Add 10-15 new layout archetypes (big number, comparison, timeline, process, quote, agenda, closing, team, matrix, bento grid, dashboard, image+text, section divider, metric grid)
- Build a themed React component library for graphical elements (stat cards, timelines, process steps, icon grids, comparison tables, progress indicators, callout boxes)
- These are pure React components consuming theme CSS variables — not 3D elements

### Phase 2: Corporate Template System
- Introduce `CorporateTemplate` concept that bundles: brand assets (logo, colors, fonts), layout preferences, default transitions, footer/watermark configuration
- Templates distributed as objects or npm packages
- Brand kit integration: logo placement rules, color palette enforcement, font pairing
- Master slide concept: per-layout global elements (logo position, footer text, page numbers)

### Phase 3: Enhanced Animations
- Region-level entrance animations (fade, fly, grow per layout region)
- Number counting animation for stat cards
- Staggered reveal for any list/grid component
- Progress fill animation for indicators
- Morph transition between slides (object interpolation via shared keys)

### Phase 4: Specialized Elements
- Funnel, pyramid, Venn, cycle, and org chart diagram components
- Gauge/meter graphics
- Swimlane roadmap visualization
- Before/after split view

---

## Sources

### Consulting & Deck Formats
- [McKinsey Presentation Structure (SlideModel)](https://slidemodel.com/mckinsey-presentation-structure/)
- [How McKinsey Consultants Make Presentations (Slideworks)](https://slideworks.io/resources/how-mckinsey-consultants-make-presentations)
- [Consulting Slide Structure Examples (Analyst Academy)](https://www.theanalystacademy.com/consulting-slide-structure/)
- [Real BCG Presentations (Slideworks)](https://slideworks.io/resources/54-real-bcg-presentations)
- [Sequoia Pitch Deck Template (Slidebean)](https://slidebean.com/templates/sequoia-pitch-deck-template)

### Layout Taxonomy
- [Types of Layouts in PowerPoint (MagicSlides)](https://www.magicslides.app/blog/how-many-types-of-layouts-are-in-the-powerpoint)
- [12 Types of Slides in PowerPoint (SlideModel)](https://slidemodel.com/types-of-slides/)
- [Beautiful.ai Smart Slide Templates](https://www.beautiful.ai/slide-templates)
- [Slidev Layouts](https://sli.dev/builtin/layouts)

### Graphical Elements
- [Types of Diagrams (Venngage)](https://venngage.com/blog/types-of-diagrams/)
- [Infographic Examples (Figma)](https://www.figma.com/resource-library/infographic-examples/)
- [Types of Infographics (Obata)](https://obata.com/10-types-of-infographics/)

### Template Systems
- [What is a Slide Master (Microsoft)](https://support.microsoft.com/en-us/office/what-is-a-slide-master-in-powerpoint-b9abb2a0-7aef-4257-a14e-4329c904da54)
- [Slidev Theme System](https://sli.dev/guide/layout)
- [Reveal.js Themes](https://revealjs.com/themes/)

### Animation
- [PowerPoint Animation Guide (Hype Presentations)](https://hypepresentations.com/blog/powerpoint-animation/)
- [PowerPoint Morph Transition (Microsoft)](https://support.microsoft.com/en-us/office/use-the-morph-transition-in-powerpoint-8dd1c7b2-b935-44f5-a74c-741d8d9244ea)
- [Animation in Data Visualization (Observable)](https://observablehq.com/blog/effective-animation)

### Modern Trends
- [2026 Guide to AI Presentation Makers (NerdLevelTech)](https://nerdleveltech.com/the-2026-guide-to-ai-presentation-makers-gamma-tome-beautifulai-canva)
- [Presentation Design Trends 2026 (SlideRabbit)](https://sliderabbit.com/blog/presentation-design-trends-shaping-modern-slides-in-2026/)
- [Bento Grid Design Guide (Landdding)](https://landdding.com/blog/blog-bento-grid-design-guide)
- [Apple & Google Presentation Mastery (Wonderslide)](https://wonderslide.com/blog/how-apple-and-google-mastered-the-art-of-presentations/)
