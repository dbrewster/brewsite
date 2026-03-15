# BrewSite Claude Author — Documentation Writing Guide

**This README is for BrewSite product managers and technical writers only.**
It is not indexed, not embedded, and not served to developers. It is the authoritative guide on how to write content for the `docs/` directory so that Claude retrieves it accurately and uses it correctly.

---

## The Fundamental Shift: You Are Not Writing for Humans

Every instinct you have from writing human documentation will work against you here. Resist it.

Human documentation optimizes for: reading order, progressive disclosure, conceptual scaffolding, "by the end of this guide you will understand...". These patterns assume a reader who starts at the top, follows a narrative arc, and builds context as they go.

**Claude does not do any of that.** Claude retrieves individual chunks based on semantic similarity to a query. It gets 3–5 chunks back, each from a different part of the docs, with no guaranteed order and no shared context between them. Every chunk must stand completely on its own.

Write as if each `##` section is the *only thing Claude will read* when answering a specific question. Because often, it is.

---

## The Chunking Model

The build pipeline chunks every document by `##` section headers. Each `##` section becomes exactly one retrieval unit — one vector in the index. This is the atomic unit of documentation.

**What this means for you:**

- Every `##` section must be self-contained. No "as described above." No "see the previous section." No forward references that assume retrieval order.
- Code examples belong **inside** the `##` section they explain. A code example separated from its explanation by a section break will be retrieved without context and will be useless.
- `###` subsections are fine for organization within a `##` chunk. They do not create new retrieval units — they stay part of the parent `##` chunk.
- A `##` section that contains only a heading and "see the other file for details" is a retrieval unit that returns nothing useful. Never do this.

---

## The Token Budget

The embedding model (`nomic-embed-text-v1.5`) has an **8,192-token context window**. A single `##` section will almost never approach this limit. The practical target is:

- **200–800 tokens** of prose per `##` section
- Code examples are included in this count (roughly 1 token per 3–4 characters of code)
- A tight paragraph of explanation + a 15-line code example ≈ 300–400 tokens — exactly right

If a `##` section is running past 1,000 tokens, split it into two `##` sections with more specific headings. If it is under 100 tokens, it probably does not contain enough information to be useful when retrieved alone — merge it with a related section or expand it.

---

## Voice and Style

**Authoritative.** Never hedge. Not "you might want to consider" — write "use X when Y." Claude will deliver your words to a developer as if they are ground truth. If you hedge, Claude hedges. If you are direct, Claude is direct.

**Code first.** Lead with the code example, follow with the explanation. Developers using Claude are trying to author scenes — they pattern-match on code faster than they parse prose. A section that opens with a TypeScript example and then explains what it does is retrieved and applied correctly far more often than a section that explains for three paragraphs before showing any code.

**Exact API names.** Every prop name, component name, and type name must exactly match the source code. Do not paraphrase. Do not use friendly aliases. If the prop is `inertiaSensitivity`, write `inertiaSensitivity` — not "inertia setting" or "scroll sensitivity." The retrieval system matches on exact terms; Claude autocompletes from exact terms; developers get TypeScript errors from wrong terms.

**Use real TypeScript.** Every code example must be valid TSX that would actually compile given the correct imports. No pseudocode. No `// ... rest of props`. No placeholder values that would cause runtime errors. Show real data, real prop values, real import paths.

---

## Writing Retrievable Section Headings

The `##` heading is the strongest retrieval signal in the chunk. A developer asking "how do I position a camera to look at a model from the front" needs to hit a section whose heading and content both answer that question.

**Good headings:**
```
## Positioning the Camera in NVS Space
## Entry Transitions Belong to the Incoming Scene
## Bar Chart Data Format
## Wiring Camera Orbit to InputController
## What happens when the window resizes
```

**Bad headings:**
```
## Overview
## Usage
## Notes
## More Information
## Other Considerations
```

Generic headings produce low-quality retrieval. A section titled "## Overview" inside `camera.md` will compete with every other "## Overview" in the index and win none of them cleanly. Make headings specific enough that the heading alone answers "what is this section about."

---

## The "When to Use" Pattern

This is the most underrated documentation pattern for bot-facing content.

A bot that knows all the props of every chart type still cannot choose the right chart without decision logic. A bot that knows all the camera modes still cannot pick the right mode without understanding *when* each mode applies. Props describe *what*. Decision sections describe *why* and *when*.

Every element or concept that has multiple variants, modes, or types needs a `## When to Use X vs Y` section. This section does not repeat props — it explains the decision:

```markdown
## When to Use Bar Chart vs Line Chart

Use a bar chart when comparing discrete categories: revenue by product,
users by country, conversions by campaign. The visual emphasis is on
individual values and their relative size.

Use a line chart when showing continuous change over time or ordered
progression. The visual emphasis is on trend and rate of change.

Do not use a line chart for unordered categories — the implied continuity
between points is misleading when categories have no natural sequence.
```

This section will be retrieved by queries like "what chart should I use to compare values" and "when should I use a bar chart" — queries that a prop reference doc will never satisfy.

---

## The Gotchas File

`guides/common-gotchas.md` is the most valuable file in the index over time. It is the only file that captures *failure modes* — the things Claude gets wrong, the things developers try that do not work, the silent failures that take an hour to debug.

Every entry follows this exact structure:

```markdown
## G-XXX: [Short description of the mistake]

**Symptom:** What the developer observes — the error message, the visual bug, the silent failure.
**Cause:** Why this happens — the architectural reason, the misunderstanding.
**Rule:** The correct mental model in one sentence.

[Code showing the WRONG way, then the RIGHT way]
```

**Add to this file whenever:**
- A bot (Claude or otherwise) makes a mistake authoring a BrewSite scene
- A developer files an issue that turns out to be a misunderstanding of the API
- A code review catches a pattern mistake that is likely to recur
- You discover during doc writing that something works counterintuitively

Do not wait until you have a large batch to add. Add one entry at a time, immediately when you learn of a new failure mode. This file compounds in value over time.

---

## File Organization Principles

**Group related topics in one file.** A file covers one coherent concept. `camera.md` covers everything about authoring camera elements. This is for human authoring ease — related content stays together, diffs are coherent, the structure is navigable.

**Split into separate files when topics are independently retrievable.** If a developer will query specifically for "bar chart" and never for "all chart types at once," each chart type is its own file. If two topics always appear together in queries (floor element surface types always appear with the floor element), they belong in one file.

**The test:** Can a developer form a specific, focused query that should retrieve *only this doc* and not others? If yes, it is its own file. If a developer's query should always bring back this content alongside related content from the same file, they belong together.

**Never create a file that is just a pointer to other files.** An `index.md` that says "see `bar-chart.md` for bar charts and `line-chart.md` for line charts" is a retrieval unit that returns zero useful information. Every file must contain real content.

---

## Keeping Docs Accurate

**Read source code, not PRDs.** PRDs are directional — they describe intended state, not current state. A PRD may be ahead of implementation (features not yet shipped) or behind it (implementation details changed during build). The source code is ground truth. Always read `types.ts` and `dsl.tsx` for the element you are documenting.

**Prop names must come from types.** If you are documenting a prop, read the TypeScript type definition for that prop. Do not infer names from example code — examples may use shorthand, spread operators, or defaults that obscure actual prop names. Go to the type.

**Update docs when APIs change.** When a breaking change ships — a prop is renamed, a component is removed, a behavior changes — update the relevant doc files as part of that release. Stale documentation is worse than no documentation because Claude will confidently generate broken code.

**When in doubt, write a test.** If you are unsure whether a feature works a certain way, look at the test files in `__tests__/` directories. Tests document intended behavior and are usually more current than any prose documentation.

---

## What Not to Write

**Do not write tutorials.** Step-by-step walkthroughs ("first, install the package; second, create a scene file; third, add a camera...") produce poor retrieval chunks because each step only makes sense in sequence. Tutorials belong in a separate human-readable getting-started guide, not in the indexed docs. Write reference content: here is the API, here is an example, here is when to use it.

**Do not write motivational prose.** "BrewSite makes it easy and powerful to create stunning 3D marketing experiences that will delight your users." This occupies token budget and degrades retrieval quality. Every word that is not information is a word that pushes information out of the retrieval window.

**Do not cross-reference without also containing the answer.** "For NVS coordinate details, see the NVS spatial model guide." This is fine as an additional pointer — but the current `##` section must still answer the question on its own. Do not substitute a cross-reference for the actual content.

**Do not use placeholder code.** `// TODO: fill in actual values` or `const myData = [/* your data here */]` in code examples will cause Claude to generate incomplete code. Every example must be complete and runnable.

---

## Directory Structure

```
docs/
  README.md              ← you are here (not indexed)
  guides/                ← cross-cutting concepts, embedding modes, spatial model
  core/                  ← @brewsite/core element and DSL docs
  diagram/               ← @brewsite/diagram docs
  model/                 ← @brewsite/model docs
  charts/                ← @brewsite/charts docs
  screens/               ← @brewsite/screens docs
```

Add new subdirectories when a new published package is added to the toolkit. Every package that has a scene-authoring DSL surface needs its own docs directory.

---

## Checklist Before Committing New Docs

- [ ] Every `##` section is self-contained — no forward or backward references that assume reading order
- [ ] Every code example is inside the `##` section it explains, not separated from it
- [ ] Every prop name, component name, and type name exactly matches the source code
- [ ] All code examples are valid TypeScript/TSX with real values (no pseudocode, no placeholders)
- [ ] Section headings are specific enough to answer "what is this section about" without reading the content
- [ ] Any element or concept with multiple variants has a "when to use X vs Y" section
- [ ] You read `types.ts` and `dsl.tsx` (not PRDs) for every prop you documented
- [ ] If you found a counterintuitive behavior while writing, you added it to `guides/common-gotchas.md`
